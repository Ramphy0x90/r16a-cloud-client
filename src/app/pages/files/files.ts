import {
	ChangeDetectorRef,
	Component,
	ElementRef,
	inject,
	OnDestroy,
	ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionsSubject, Store } from '@ngrx/store';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	concat,
	EMPTY,
	filter,
	finalize,
	firstValueFrom,
	forkJoin,
	from,
	map,
	mergeMap,
	Observable,
	of,
	shareReplay,
	startWith,
	Subject,
	switchMap,
	take,
	takeUntil,
} from 'rxjs';
import { FileService } from '../../services/file.service';
import { FilesCacheService } from '../../services/files-cache.service';
import { UserService } from '../../services/user.service';
import { ImagePreviewService } from '../../services/image-preview.service';
import { ActiveModal, File, SortDirection, SortField, ViewMode } from '../../types/file';
import type { UserPreferences } from '../../types/user';
import { UserResponse } from '../../types/user';
import {
	extractDownloadFilename,
	isImageFile,
	triggerBrowserDownload,
} from '../../utils/file-utils';
import { ListView } from './list-view/list-view';
import { GridView } from './grid-view/grid-view';
import { FilesToolbar } from '../../components/files-toolbar/files-toolbar';
import {
	ImagePreviewModal,
	ImagePreviewModalState,
} from './image-preview-modal/image-preview-modal';
import { InViewportDirective } from '../../directives/in-viewport.directive';
import { selectUserPreferences } from '../../store/app/app.selector';
import {
	setFileToolbarState,
	toolbarBreadcrumbClicked,
	toolbarBulkDeleteClicked,
	toolbarCancelSelectionClicked,
	toolbarCreateFolderClicked,
	toolbarDownloadClicked,
	toolbarRenameClicked,
	toolbarRootClicked,
	toolbarSelectionModeChanged,
	toolbarShareClicked,
	toolbarSortDirectionChanged,
	toolbarSortFieldChanged,
	toolbarUploadClicked,
	toolbarViewModeChanged,
} from '../../store/file/file.actions';

@Component({
	selector: 'files-page',
	imports: [
		CommonModule,
		FormsModule,
		ListView,
		GridView,
		FilesToolbar,
		ImagePreviewModal,
		InViewportDirective,
	],
	templateUrl: './files.html',
	styleUrl: './files.css',
	providers: [ImagePreviewService],
})
export class FilesPage implements OnDestroy {
	@ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

	private readonly fileService = inject(FileService);
	private readonly filesCacheService = inject(FilesCacheService);
	private readonly userService = inject(UserService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly imagePreviewService = inject(ImagePreviewService);
	private readonly store = inject(Store);
	private readonly actions$ = inject(ActionsSubject);
	private readonly destroy$ = new Subject<void>();

	private readonly ownerId$: Observable<string> = this.userService.currentUser$.pipe(
		map((owner) => owner.id),
	);

	private readonly filesSubject = new BehaviorSubject<File[]>([]);
	readonly files$: Observable<File[]> = this.filesSubject.asObservable();

	private readonly shareUsersLoadingSubject = new BehaviorSubject<boolean>(false);
	readonly shareUsersLoading$: Observable<boolean> = this.shareUsersLoadingSubject.asObservable();

	private readonly shareCandidatesSubject = new BehaviorSubject<UserResponse[]>([]);
	readonly shareCandidates$: Observable<UserResponse[]> =
		this.shareCandidatesSubject.asObservable();

	private readonly triggerFilesFetch$ = new Subject<void>();
	private readonly imagePreviewLoadQueue$ = new Subject<File>();
	private readonly imagePreviewUrlsSubject = new BehaviorSubject<Map<string, string>>(new Map());
	private readonly imagePreviewOpen$ = new Subject<File>();
	private readonly imagePreviewClose$ = new Subject<void>();

	private readonly imagePreviewStateSubject = new BehaviorSubject<ImagePreviewModalState>({
		show: false,
		fileName: null,
		fileId: null,
		url: null,
		loading: false,
	});

	readonly imagePreviewState$ = this.imagePreviewStateSubject.asObservable();
	readonly emptyImagePreviewMap = new Map<string, string>();
	readonly imagePreviewUrls$: Observable<Map<string, string>> = this.imagePreviewUrlsSubject.pipe(
		shareReplay({ bufferSize: 1, refCount: true }),
		takeUntil(this.destroy$),
	);

	private nextPageToLoad = 0;
	private readonly pageSize = 50;

	/** Bumps on each full list refresh so in-flight "load more" cannot append after navigation/sort. */
	private fileListGeneration = 0;
	private toolbarSyncScheduled = false;

	/** True when the server reports another page after the last loaded one. */
	hasMoreFiles = false;
	loadingMore = false;

	viewMode: ViewMode = 'grid';
	sortField: SortField = 'name';
	sortDirection: SortDirection = 'asc';
	currentFolder: File | null = null;
	breadcrumbs: File[] = [];
	loading = false;
	selectionMode = false;
	selectedFileIds = new Set<string>();

	activeModal: ActiveModal = 'none';
	modalFile: File | null = null;

	selectedFile: File | null = null;
	selectedShareUserIds = new Set<string>();
	shareSaving = false;

	newFolderName = '';
	renameName = '';

	/** Shown while uploads are in progress (bounded concurrency). */
	uploadOverlay: {
		currentIndex: number;
		fileCount: number;
		currentName: string;
		overallLoaded: number;
		overallTotal: number;
	} | null = null;

	uploadErrors: string[] = [];

	constructor() {
		this.syncToolbarState();

		this.store
			.select(selectUserPreferences)
			.pipe(
				filter((p): p is UserPreferences => p !== null),
				take(1),
				takeUntil(this.destroy$),
			)
			.subscribe((prefs) => {
				this.viewMode = prefs.defaultViewMode;
				this.scheduleToolbarSync();
			});

		this.actions$
			.pipe(takeUntil(this.destroy$))
			.subscribe((action) => this.handleToolbarAction(action));

		combineLatest([this.triggerFilesFetch$.pipe(startWith(void 0)), this.ownerId$])
			.pipe(
				filter(([_, ownerId]) => ownerId != null),
				switchMap(([_, ownerId]) => {
					this.fileListGeneration++;
					const gen = this.fileListGeneration;
					return this.filesCacheService
						.getFilesPageCached(
							ownerId,
							this.currentFolder?.id ?? null,
							this.sortField,
							this.sortDirection,
							0,
							this.pageSize,
						)
						.pipe(map((page) => ({ page, gen })));
				}),
				takeUntil(this.destroy$),
			)
			.subscribe(({ page, gen }) => {
				if (gen !== this.fileListGeneration) return;
				this.filesSubject.next(page.content);
				this.hasMoreFiles = !page.last;
				this.nextPageToLoad = page.number + 1;
				this.loadingMore = false;
				this.cdr.markForCheck();
			});

		this.files$.pipe(takeUntil(this.destroy$)).subscribe((files) => {
			const imageFiles = files.filter(isImageFile);
			this.imagePreviewUrlsSubject.next(
				this.imagePreviewService.buildThumbnailMapForFiles(imageFiles),
			);
		});

		this.imagePreviewLoadQueue$
			.pipe(
				mergeMap((file) => this.imagePreviewService.ensureThumbnail$(file), 4),
				takeUntil(this.destroy$),
			)
			.subscribe((preview) => {
				if (!preview) return;
				const next = new Map(this.imagePreviewUrlsSubject.value);
				next.set(preview[0], preview[1]);
				this.imagePreviewUrlsSubject.next(next);
			});

		this.imagePreviewOpen$
			.pipe(
				switchMap((file) => {
					const cachedUrl = this.imagePreviewService.ensureFullPreview$(file);
					const initialState: ImagePreviewModalState = {
						show: true,
						fileName: file.name,
						fileId: file.id,
						url: null,
						loading: true,
					};

					return concat(
						of(initialState),
						cachedUrl.pipe(
							take(1),
							map((preview) => ({
								...initialState,
								url: preview?.[1] ?? null,
								loading: false,
							})),
						),
					).pipe(takeUntil(this.imagePreviewClose$));
				}),
				takeUntil(this.destroy$),
			)
			.subscribe((state) => this.imagePreviewStateSubject.next(state));
	}

	ngOnDestroy(): void {
		this.imagePreviewClose$.next();
		this.imagePreviewService.revokeAll();
		this.destroy$.next();
		this.destroy$.complete();
	}

	onViewModeChange(mode: ViewMode): void {
		this.viewMode = mode;
		this.scheduleToolbarSync();
	}

	onSortFieldChange(field: SortField): void {
		this.sortField = field;
		this.sortDirection = 'asc';
		this.requestFilesRefresh();
		this.scheduleToolbarSync();
	}

	onSortDirectionChange(direction: SortDirection): void {
		this.sortDirection = direction;
		this.requestFilesRefresh();
		this.scheduleToolbarSync();
	}

	onSelectionModeChange(enabled: boolean): void {
		this.selectionMode = enabled;
		if (!enabled) this.selectedFileIds = new Set();
		this.scheduleToolbarSync();
	}

	toggleFileSelection(file: File): void {
		const next = new Set(this.selectedFileIds);
		if (next.has(file.id)) {
			next.delete(file.id);
		} else {
			next.add(file.id);
		}
		this.selectedFileIds = next;
		this.scheduleToolbarSync();
	}

	cancelSelection(): void {
		this.selectionMode = false;
		this.selectedFileIds = new Set();
		this.scheduleToolbarSync();
	}

	onFileClick(file: File): void {
		if (file.isDirectory) {
			this.navigateToFolder(file);
			return;
		}
		if (isImageFile(file)) {
			this.openImagePreview(file);
		}
	}

	navigateToFolder(folder: File): void {
		this.breadcrumbs = [...this.breadcrumbs, folder];
		this.currentFolder = folder;
		this.selectedFile = null;
		this.cancelSelection();
		this.requestFilesRefresh();
		this.scheduleToolbarSync();
	}

	navigateToRoot(): void {
		this.breadcrumbs = [];
		this.currentFolder = null;
		this.selectedFile = null;
		this.cancelSelection();
		this.requestFilesRefresh();
		this.scheduleToolbarSync();
	}

	navigateToBreadcrumb(index: number): void {
		this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
		this.currentFolder = this.breadcrumbs[index] ?? null;
		this.selectedFile = null;
		this.cancelSelection();
		this.requestFilesRefresh();
		this.scheduleToolbarSync();
	}

	triggerUpload(): void {
		this.fileInput.nativeElement.click();
	}

	async onFileSelected(event: Event): Promise<void> {
		const ownerId = await firstValueFrom(this.ownerId$);
		const input = event.target as HTMLInputElement;

		if (!input.files?.length || ownerId === null) return;

		const files = Array.from(input.files);
		const parentId = this.currentFolder?.id ?? null;
		const overallTotal = files.reduce((sum, f) => sum + f.size, 0);

		this.uploadErrors = [];
		this.uploadOverlay = {
			currentIndex: 0,
			fileCount: files.length,
			currentName: '',
			overallLoaded: 0,
			overallTotal,
		};
		this.cdr.markForCheck();

		from(files.map((file, index) => ({ file, index })))
			.pipe(
				mergeMap(({ file, index }) => {
					const prevCompleted = files.slice(0, index).reduce((sum, f) => sum + f.size, 0);
					this.uploadOverlay = {
						currentIndex: index + 1,
						fileCount: files.length,
						currentName: file.name,
						overallLoaded: prevCompleted,
						overallTotal,
					};
					this.cdr.markForCheck();

					return this.fileService
						.uploadFile(ownerId, parentId, file, (loaded, total) => {
							this.uploadOverlay = {
								currentIndex: index + 1,
								fileCount: files.length,
								currentName: file.name,
								overallLoaded: prevCompleted + loaded,
								overallTotal,
							};
							this.cdr.markForCheck();
						})
						.pipe(
							catchError((err: unknown) => {
								const message = err instanceof Error ? err.message : 'Upload failed';
								this.uploadErrors.push(`${file.name}: ${message}`);
								this.cdr.markForCheck();
								return EMPTY;
							}),
						);
				}, 2),
				finalize(() => {
					this.uploadOverlay = null;
					this.refreshCurrentFolderAfterMutation();
					this.cdr.markForCheck();
				}),
				takeUntil(this.destroy$),
			)
			.subscribe();

		input.value = '';
	}

	clearUploadErrors(): void {
		this.uploadErrors = [];
	}

	openCreateFolderModal(): void {
		this.newFolderName = '';
		this.activeModal = 'create-folder';
	}

	async createFolder(): Promise<void> {
		const ownerId = await firstValueFrom(this.ownerId$);

		if (!this.newFolderName.trim() || ownerId === null) return;

		this.fileService
			.createFile({
				name: this.newFolderName.trim(),
				ownerId,
				parentId: this.currentFolder?.id ?? null,
				isDirectory: true,
			})
			.pipe(take(1))
			.subscribe({
				next: () => {
					this.closeModals();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => console.error('Failed to create folder:', err),
			});
	}

	openRenameModal(file: File, event: Event): void {
		event.stopPropagation();
		this.modalFile = file;
		this.renameName = file.name;
		this.activeModal = 'rename';
	}

	async openRenameSelected(): Promise<void> {
		const files = await firstValueFrom(this.files$);
		const selectedId = Array.from(this.selectedFileIds)[0];
		const file = files.find((f) => f.id === selectedId);
		if (file) {
			this.modalFile = file;
			this.renameName = file.name;
			this.activeModal = 'rename';
		}
	}

	async openShareSelected(): Promise<void> {
		const files = await firstValueFrom(this.files$);
		const selectedId = Array.from(this.selectedFileIds)[0];
		const file = files.find((f) => f.id === selectedId);
		if (!file) return;

		this.modalFile = file;
		this.selectedShareUserIds = new Set(file.sharedWithIds);
		this.activeModal = 'share';
		this.loadShareCandidates();
	}

	toggleSharedUser(userId: string): void {
		const next = new Set(this.selectedShareUserIds);
		if (next.has(userId)) {
			next.delete(userId);
		} else {
			next.add(userId);
		}
		this.selectedShareUserIds = next;
	}

	isSharedUserSelected(userId: string): boolean {
		return this.selectedShareUserIds.has(userId);
	}

	saveShareSettings(): void {
		if (!this.modalFile || this.shareSaving) return;

		const fileId = this.modalFile.id;
		const sharedWithIds = Array.from(this.selectedShareUserIds);
		this.shareSaving = true;
		this.fileService
			.updateFileSharing(fileId, sharedWithIds)
			.pipe(take(1))
			.subscribe({
				next: () => {
					this.closeModals();
					if (this.selectionMode) this.cancelSelection();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => {
					console.error('Failed to update sharing:', err);
					this.shareSaving = false;
				},
				complete: () => {
					this.shareSaving = false;
				},
			});
	}

	renameFile(): void {
		if (!this.renameName.trim() || !this.modalFile) return;

		this.fileService
			.updateFile(this.modalFile.id, { name: this.renameName.trim() })
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: () => {
					this.closeModals();
					if (this.selectionMode) this.cancelSelection();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => console.error('Failed to rename:', err),
			});
	}

	openDeleteConfirm(file: File, event: Event): void {
		event.stopPropagation();
		this.modalFile = file;
		this.activeModal = 'delete';
	}

	confirmDelete(): void {
		if (!this.modalFile) return;

		const idToDelete = this.modalFile.id;

		this.fileService
			.deleteFile(idToDelete)
			.pipe(take(1))
			.subscribe({
				next: () => {
					if (this.selectedFile?.id === idToDelete) this.selectedFile = null;
					this.closeModals();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => console.error('Failed to delete:', err),
			});
	}

	openBulkDeleteConfirm(): void {
		if (this.selectedFileIds.size === 0) return;
		this.activeModal = 'bulk-delete';
	}

	confirmBulkDelete(): void {
		const ids = Array.from(this.selectedFileIds);
		if (ids.length === 0) return;

		forkJoin(ids.map((id) => this.fileService.deleteFile(id)))
			.pipe(take(1))
			.subscribe({
				next: () => {
					this.activeModal = 'none';
					this.cancelSelection();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => {
					console.error('Failed to delete files:', err);
					this.activeModal = 'none';
					this.refreshCurrentFolderAfterMutation();
				},
			});
	}

	onImageVisible(file: File): void {
		if (!isImageFile(file)) return;
		if (this.imagePreviewService.getThumbnailUrl(file.id)) return;
		this.imagePreviewLoadQueue$.next(file);
	}

	async downloadSelected(): Promise<void> {
		const selectedIds = Array.from(this.selectedFileIds);
		if (selectedIds.length === 0) return;

		const files = await firstValueFrom(this.files$);
		const selectedFiles = files.filter((file) => this.selectedFileIds.has(file.id));
		if (selectedFiles.length === 0) return;

		const singleSelected = selectedFiles.length === 1 ? selectedFiles[0] : null;
		const download$ =
			singleSelected && !singleSelected.isDirectory
				? this.fileService.downloadFile(singleSelected.id)
				: this.fileService.downloadFiles(selectedIds);

		download$.pipe(take(1)).subscribe({
			next: (response) => {
				if (!response.body) return;

				const fallbackName =
					singleSelected && !singleSelected.isDirectory
						? singleSelected.name
						: `download_${Date.now()}.zip`;

				const filename = extractDownloadFilename(response) ?? fallbackName;
				triggerBrowserDownload(response.body, filename);
				this.cancelSelection();
			},
			error: (err) => console.error('Failed to download selected files:', err),
		});
	}

	closeModals(): void {
		this.activeModal = 'none';
		this.modalFile = null;
		this.closeImagePreviewModal();
		this.shareCandidatesSubject.next([]);
		this.selectedShareUserIds = new Set();
		this.shareUsersLoadingSubject.next(false);
		this.shareSaving = false;
	}

	closeImagePreviewModal(): void {
		this.imagePreviewClose$.next();
		this.imagePreviewStateSubject.next({
			show: false,
			fileName: null,
			fileId: null,
			url: null,
			loading: false,
		});
	}

	private openImagePreview(file: File): void {
		this.imagePreviewOpen$.next(file);
	}

	loadMoreFiles(): void {
		if (!this.hasMoreFiles || this.loadingMore) return;
		const gen = this.fileListGeneration;
		this.loadingMore = true;
		this.cdr.markForCheck();
		firstValueFrom(this.ownerId$).then((ownerId) => {
			if (ownerId == null) {
				this.loadingMore = false;
				this.cdr.markForCheck();
				return;
			}
			this.filesCacheService
				.getFilesPageCached(
					ownerId,
					this.currentFolder?.id ?? null,
					this.sortField,
					this.sortDirection,
					this.nextPageToLoad,
					this.pageSize,
				)
				.pipe(take(1), takeUntil(this.destroy$))
				.subscribe({
					next: (page) => {
						if (gen !== this.fileListGeneration) {
							this.loadingMore = false;
							this.cdr.markForCheck();
							return;
						}
						this.filesSubject.next([...this.filesSubject.value, ...page.content]);
						this.hasMoreFiles = !page.last;
						this.nextPageToLoad = page.number + 1;
						this.loadingMore = false;
						this.cdr.markForCheck();
					},
					error: () => {
						if (gen === this.fileListGeneration) {
							this.loadingMore = false;
						}
						this.cdr.markForCheck();
					},
				});
		});
	}

	private requestFilesRefresh(): void {
		this.triggerFilesFetch$.next();
	}

	private async refreshCurrentFolderAfterMutation(): Promise<void> {
		const ownerId = await firstValueFrom(this.ownerId$);
		this.filesCacheService.invalidateFolder(ownerId, this.currentFolder?.id ?? null);
		this.requestFilesRefresh();
	}

	private loadShareCandidates(): void {
		const fileToShare = this.modalFile;
		if (!fileToShare) return;
		this.shareUsersLoadingSubject.next(true);

		forkJoin({
			currentUser: this.userService.currentUser$.pipe(take(1)),
			usersPage: this.userService.getUsers().pipe(take(1)),
		})
			.pipe(
				map(({ currentUser, usersPage }) =>
					usersPage.content.filter(
						(user) => user.id !== currentUser.id && user.id !== fileToShare.ownerId,
					),
				),
				catchError((error) => {
					console.error('Failed to load users for sharing:', error);
					return of([]);
				}),
				finalize(() => this.shareUsersLoadingSubject.next(false)),
				take(1),
			)
			.subscribe((users) => this.shareCandidatesSubject.next(users));
	}

	private handleToolbarAction(action: { type: string }): void {
		switch (action.type) {
			case toolbarRootClicked.type:
				this.navigateToRoot();
				break;
			case toolbarBreadcrumbClicked.type:
				this.navigateToBreadcrumb((action as ReturnType<typeof toolbarBreadcrumbClicked>).index);
				break;
			case toolbarViewModeChanged.type:
				this.onViewModeChange((action as ReturnType<typeof toolbarViewModeChanged>).mode);
				break;
			case toolbarSortFieldChanged.type:
				this.onSortFieldChange((action as ReturnType<typeof toolbarSortFieldChanged>).field);
				break;
			case toolbarSortDirectionChanged.type:
				this.onSortDirectionChange(
					(action as ReturnType<typeof toolbarSortDirectionChanged>).direction,
				);
				break;
			case toolbarSelectionModeChanged.type:
				this.onSelectionModeChange(
					(action as ReturnType<typeof toolbarSelectionModeChanged>).enabled,
				);
				break;
			case toolbarShareClicked.type:
				this.openShareSelected();
				break;
			case toolbarRenameClicked.type:
				this.openRenameSelected();
				break;
			case toolbarDownloadClicked.type:
				this.downloadSelected();
				break;
			case toolbarBulkDeleteClicked.type:
				this.openBulkDeleteConfirm();
				break;
			case toolbarCancelSelectionClicked.type:
				this.cancelSelection();
				break;
			case toolbarCreateFolderClicked.type:
				this.openCreateFolderModal();
				break;
			case toolbarUploadClicked.type:
				this.triggerUpload();
				break;
		}
	}

	private scheduleToolbarSync(): void {
		if (this.toolbarSyncScheduled) return;
		this.toolbarSyncScheduled = true;
		queueMicrotask(() => {
			this.toolbarSyncScheduled = false;
			this.syncToolbarState();
		});
	}

	private syncToolbarState(): void {
		this.store.dispatch(
			setFileToolbarState({
				breadcrumbs: this.breadcrumbs,
				selectionMode: this.selectionMode,
				selectedCount: this.selectedFileIds.size,
				viewMode: this.viewMode,
				sortField: this.sortField,
				sortDirection: this.sortDirection,
			}),
		);
	}
}
