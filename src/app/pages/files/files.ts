import { Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	concat,
	filter,
	finalize,
	firstValueFrom,
	forkJoin,
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
	timeout,
} from 'rxjs';
import { FileService } from '../../services/file.service';
import { FilesCacheService } from '../../services/files-cache.service';
import { UserService } from '../../services/user.service';
import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { UserResponse } from '../../types/user';
import { extractDownloadFilename, isImageFile, triggerBrowserDownload } from '../../utils/file-utils';
import { ListView } from './list-view/list-view';
import { GridView } from './grid-view/grid-view';
import { FileOptions } from '../../components/file-options/file-options';
import { Breadcrumb } from '../../components/breadcrumb/breadcrumb';
import { ImagePreviewModal, ImagePreviewModalState } from './image-preview-modal/image-preview-modal';

interface CachedImagePreview {
	url: string;
	expiresAt: number;
	lastAccessedAt: number;
}

@Component({
	selector: 'files-page',
	imports: [CommonModule, FormsModule, ListView, GridView, FileOptions, Breadcrumb, ImagePreviewModal],
	templateUrl: './files.html',
	styleUrl: './files.css',
})
export class FilesPage implements OnDestroy {
	@ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

	private readonly fileService = inject(FileService);
	private readonly filesCacheService = inject(FilesCacheService);
	private readonly userService = inject(UserService);
	private readonly destroy$ = new Subject<void>();

	private readonly ownerId$: Observable<string> = this.userService.currentUser$.pipe(
		map((owner) => owner.id),
	);

	private readonly triggerFilesFetch$: Subject<void> = new Subject();
	private readonly imagePreviewLoadQueue$ = new Subject<File>();
	private readonly imagePreviewUrlsSubject = new BehaviorSubject<Map<string, string>>(new Map());
	private readonly imagePreviewOpen$ = new Subject<File>();
	private readonly imagePreviewClose$ = new Subject<void>();

	private readonly thumbnailPreviewCache = new Map<string, CachedImagePreview>();
	private readonly thumbnailPreviewInFlight = new Map<
		string,
		Observable<[string, string] | null>
	>();
	private readonly fullImagePreviewCache = new Map<string, string>();

	private readonly thumbnailPreviewTtlMs = 5 * 60_000;
	private readonly maxThumbnailCacheSize = 400;

	private readonly imagePreviewStateSubject = new BehaviorSubject<ImagePreviewModalState>({
		show: false,
		fileName: null,
		fileId: null,
		url: null,
		loading: false,
	});
	readonly imagePreviewState$ = this.imagePreviewStateSubject.asObservable();
	readonly emptyImagePreviewMap = new Map<string, string>();

	readonly files$: Observable<File[]> = combineLatest([
		this.triggerFilesFetch$.pipe(startWith(void 0)),
		this.ownerId$,
	]).pipe(
		filter(([_, ownerId]) => ownerId != null),
		switchMap(([_, ownerId]) => {
			const parentId = this.currentFolder?.id ?? null;
			return this.filesCacheService.getFilesCached(
				ownerId,
				parentId,
				this.sortField,
				this.sortDirection,
			);
		}),
		shareReplay({ bufferSize: 1, refCount: true }),
		takeUntil(this.destroy$),
	);

	readonly imagePreviewUrls$: Observable<Map<string, string>> = this.imagePreviewUrlsSubject.pipe(
		shareReplay({ bufferSize: 1, refCount: true }),
		takeUntil(this.destroy$),
	);

	viewMode: ViewMode = 'grid';
	sortField: SortField = 'name';
	sortDirection: SortDirection = 'asc';

	currentFolder: File | null = null;
	breadcrumbs: File[] = [];
	loading = false;

	selectionMode = false;
	selectedFileIds = new Set<string>();

	showCreateFolderModal = false;
	showRenameModal = false;
	showDeleteConfirm = false;
	showBulkDeleteConfirm = false;
	showShareModal = false;

	selectedFile: File | null = null;
	fileToDelete: File | null = null;
	fileToRename: File | null = null;
	fileToShare: File | null = null;
	selectedShareUserIds = new Set<string>();
	shareSaving = false;

	private readonly shareUsersLoadingSubject = new BehaviorSubject<boolean>(false);
	readonly shareUsersLoading$: Observable<boolean> = this.shareUsersLoadingSubject.asObservable();
	private readonly shareCandidatesSubject = new BehaviorSubject<UserResponse[]>([]);
	readonly shareCandidates$: Observable<UserResponse[]> =
		this.shareCandidatesSubject.asObservable();

	newFolderName = '';
	renameName = '';

	constructor() {
		this.files$
			.pipe(takeUntil(this.destroy$))
			.subscribe((files) => this.reconcileThumbnailCacheWithFiles(files));

		this.imagePreviewLoadQueue$
			.pipe(
				mergeMap((file) => this.ensureThumbnailPreview$(file), 4),
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
					const cachedUrl = this.fullImagePreviewCache.get(file.id) ?? null;
					const initialState: ImagePreviewModalState = {
						show: true,
						fileName: file.name,
						fileId: file.id,
						url: cachedUrl,
						loading: cachedUrl == null,
					};

					if (cachedUrl) {
						return of(initialState);
					}

					return concat(
						of(initialState),
						this.ensureFullImagePreview$(file).pipe(
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
		this.revokeAllImagePreviewUrls();
		this.destroy$.next();
		this.destroy$.complete();
	}

	onViewModeChange(mode: ViewMode): void {
		this.viewMode = mode;
	}

	onSortFieldChange(field: SortField): void {
		this.sortField = field;
		this.sortDirection = 'asc';
		this.requestFilesRefresh();
	}

	onSortDirectionChange(direction: SortDirection): void {
		this.sortDirection = direction;
		this.requestFilesRefresh();
	}

	onSelectionModeChange(enabled: boolean): void {
		this.selectionMode = enabled;
		if (!enabled) {
			this.selectedFileIds = new Set();
		}
	}

	toggleFileSelection(file: File): void {
		const next = new Set(this.selectedFileIds);
		if (next.has(file.id)) {
			next.delete(file.id);
		} else {
			next.add(file.id);
		}
		this.selectedFileIds = next;
	}

	cancelSelection(): void {
		this.selectionMode = false;
		this.selectedFileIds = new Set();
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
	}

	navigateToRoot(): void {
		this.breadcrumbs = [];
		this.currentFolder = null;
		this.selectedFile = null;
		this.cancelSelection();
		this.requestFilesRefresh();
	}

	navigateToBreadcrumb(index: number): void {
		this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
		this.currentFolder = this.breadcrumbs[index] ?? null;
		this.selectedFile = null;
		this.cancelSelection();
		this.requestFilesRefresh();
	}

	triggerUpload(): void {
		this.fileInput.nativeElement.click();
	}

	async onFileSelected(event: Event): Promise<void> {
		const ownerId = await firstValueFrom(this.ownerId$);
		const input = event.target as HTMLInputElement;

		if (!input.files?.length || ownerId === null) return;

		const uploads$ = Array.from(input.files).map((file) =>
			this.fileService.uploadFile(ownerId, this.currentFolder?.id ?? null, file),
		);

		forkJoin(uploads$)
			.pipe(take(1))
			.subscribe({
				next: () => this.refreshCurrentFolderAfterMutation(),
				error: (err) => {
					console.error('Failed to upload files:', err);
					this.refreshCurrentFolderAfterMutation();
				},
			});

		input.value = '';
	}

	openCreateFolderModal(): void {
		this.newFolderName = '';
		this.showCreateFolderModal = true;
	}

	async createFolder(): Promise<void> {
		const ownerId = await firstValueFrom(this.ownerId$);

		if (!this.newFolderName.trim() || ownerId === null) return;

		this.fileService
			.createFile({
				name: this.newFolderName.trim(),
				ownerId: ownerId,
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
		this.fileToRename = file;
		this.renameName = file.name;
		this.showRenameModal = true;
	}

	openRenameSelected(): void {
		this.files$.pipe(take(1)).subscribe((files) => {
			const selectedId = Array.from(this.selectedFileIds)[0];
			const file = files.find((f) => f.id === selectedId);
			if (file) {
				this.fileToRename = file;
				this.renameName = file.name;
				this.showRenameModal = true;
			}
		});
	}

	openShareSelected(): void {
		this.files$.pipe(take(1)).subscribe((files) => {
			const selectedId = Array.from(this.selectedFileIds)[0];
			const file = files.find((f) => f.id === selectedId);
			if (!file) return;

			this.fileToShare = file;
			this.selectedShareUserIds = new Set(file.sharedWithIds);
			this.showShareModal = true;
			this.loadShareCandidates();
		});
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
		if (!this.fileToShare || this.shareSaving) return;

		const sharedWithIds = Array.from(this.selectedShareUserIds);
		this.shareSaving = true;
		this.fileService
			.updateFileSharing(this.fileToShare.id, sharedWithIds)
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
		if (!this.renameName.trim() || !this.fileToRename) return;

		this.fileService
			.updateFile(this.fileToRename.id, { name: this.renameName.trim() })
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
		this.fileToDelete = file;
		this.showDeleteConfirm = true;
	}

	confirmDelete(): void {
		if (!this.fileToDelete) return;

		const idToDelete = this.fileToDelete.id;

		this.fileService
			.deleteFile(idToDelete)
			.pipe(take(1))
			.subscribe({
				next: () => {
					if (this.selectedFile?.id === idToDelete) {
						this.selectedFile = null;
					}
					this.closeModals();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => console.error('Failed to delete:', err),
			});
	}

	openBulkDeleteConfirm(): void {
		if (this.selectedFileIds.size === 0) return;
		this.showBulkDeleteConfirm = true;
	}

	confirmBulkDelete(): void {
		const ids = Array.from(this.selectedFileIds);
		if (ids.length === 0) return;

		forkJoin(ids.map((id) => this.fileService.deleteFile(id)))
			.pipe(take(1))
			.subscribe({
				next: () => {
					this.showBulkDeleteConfirm = false;
					this.cancelSelection();
					this.refreshCurrentFolderAfterMutation();
				},
				error: (err) => {
					console.error('Failed to delete files:', err);
					this.showBulkDeleteConfirm = false;
					this.refreshCurrentFolderAfterMutation();
				},
			});
	}

	onImageVisible(file: File): void {
		this.queueImagePreview(file);
	}

	downloadSelected(): void {
		const selectedIds = Array.from(this.selectedFileIds);
		if (selectedIds.length === 0) return;

		this.files$.pipe(take(1)).subscribe((files) => {
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
		});
	}

	closeModals(): void {
		this.showCreateFolderModal = false;
		this.showRenameModal = false;
		this.showDeleteConfirm = false;
		this.showBulkDeleteConfirm = false;
		this.showShareModal = false;
		this.closeImagePreviewModal();
		this.fileToDelete = null;
		this.fileToRename = null;
		this.fileToShare = null;
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

	private requestFilesRefresh(): void {
		this.triggerFilesFetch$.next();
	}

	private refreshCurrentFolderAfterMutation(): void {
		this.invalidateCurrentFolderFilesCache();
		this.requestFilesRefresh();
	}

	private invalidateCurrentFolderFilesCache(): void {
		this.ownerId$.pipe(take(1)).subscribe((ownerId) => {
			this.filesCacheService.invalidateFolder(ownerId, this.currentFolder?.id ?? null);
		});
	}

	private loadShareCandidates(): void {
		const fileToShare = this.fileToShare;
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
				finalize(() => {
					this.shareUsersLoadingSubject.next(false);
				}),
				take(1),
			)
			.subscribe((users) => this.shareCandidatesSubject.next(users));
	}

	private queueImagePreview(file: File): void {
		if (!isImageFile(file)) return;
		if (this.getThumbnailPreviewUrl(file.id)) return;
		if (this.thumbnailPreviewInFlight.has(file.id)) return;
		this.imagePreviewLoadQueue$.next(file);
	}

	private reconcileThumbnailCacheWithFiles(files: File[]): void {
		this.cleanupExpiredThumbnailPreviews();
		const imageFiles = files.filter((file) => isImageFile(file));
		const next = new Map<string, string>();
		for (const file of imageFiles) {
			const cachedUrl = this.getThumbnailPreviewUrl(file.id);
			if (cachedUrl) {
				next.set(file.id, cachedUrl);
			}
		}
		this.imagePreviewUrlsSubject.next(next);
	}

	private getThumbnailPreviewUrl(fileId: string): string | null {
		const cached = this.thumbnailPreviewCache.get(fileId);
		if (!cached) return null;
		if (cached.expiresAt <= Date.now()) {
			this.removeThumbnailPreview(fileId);
			return null;
		}
		cached.lastAccessedAt = Date.now();
		return cached.url;
	}

	private ensureThumbnailPreview$(file: File): Observable<[string, string] | null> {
		const existing = this.getThumbnailPreviewUrl(file.id);
		if (existing) {
			return of([file.id, existing]);
		}

		const inflight = this.thumbnailPreviewInFlight.get(file.id);
		if (inflight) {
			return inflight;
		}

		const request$ = this.fileService.downloadThumbnail(file.id, 'small').pipe(
			take(1),
			map((response) => {
				if (!response.body) return null;
				const previewUrl = URL.createObjectURL(response.body);
				this.setThumbnailPreview(file.id, previewUrl);
				return [file.id, previewUrl] as [string, string];
			}),
			catchError((err) => {
				console.error('Failed to load image preview:', err);
				return of(null);
			}),
			shareReplay({ bufferSize: 1, refCount: false }),
		);

		this.thumbnailPreviewInFlight.set(file.id, request$);
		request$.pipe(take(1)).subscribe({
			next: () => this.thumbnailPreviewInFlight.delete(file.id),
			error: () => this.thumbnailPreviewInFlight.delete(file.id),
		});

		return request$;
	}

	private ensureFullImagePreview$(file: File): Observable<[string, string] | null> {
		const existing = this.fullImagePreviewCache.get(file.id);
		if (existing) {
			return of([file.id, existing]);
		}

		return this.fileService.downloadFile(file.id).pipe(
			timeout(15_000),
			take(1),
			map((response) => {
				if (!response.body) return null;
				const previewUrl = URL.createObjectURL(response.body);
				this.fullImagePreviewCache.set(file.id, previewUrl);
				return [file.id, previewUrl] as [string, string];
			}),
			catchError((err) => {
				console.error('Failed to load full image preview:', err);
				return of(null);
			}),
		);
	}

	private setThumbnailPreview(fileId: string, url: string): void {
		this.thumbnailPreviewCache.set(fileId, {
			url,
			expiresAt: Date.now() + this.thumbnailPreviewTtlMs,
			lastAccessedAt: Date.now(),
		});
		this.evictExcessThumbnailEntries();
	}

	private evictExcessThumbnailEntries(): void {
		if (this.thumbnailPreviewCache.size <= this.maxThumbnailCacheSize) return;
		const ordered = Array.from(this.thumbnailPreviewCache.entries()).sort(
			(a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt,
		);

		for (const [fileId, preview] of ordered) {
			if (this.thumbnailPreviewCache.size <= this.maxThumbnailCacheSize) break;
			this.removeThumbnailPreview(fileId);
		}
	}

	private cleanupExpiredThumbnailPreviews(): void {
		const now = Date.now();
		for (const [fileId, preview] of this.thumbnailPreviewCache.entries()) {
			if (preview.expiresAt > now) continue;
			this.removeThumbnailPreview(fileId);
		}
	}

	private removeThumbnailPreview(fileId: string): void {
		const preview = this.thumbnailPreviewCache.get(fileId);
		if (!preview) return;
		URL.revokeObjectURL(preview.url);
		this.thumbnailPreviewCache.delete(fileId);
	}

	private revokeAllImagePreviewUrls(): void {
		for (const preview of this.thumbnailPreviewCache.values()) {
			URL.revokeObjectURL(preview.url);
		}
		this.thumbnailPreviewCache.clear();
		this.thumbnailPreviewInFlight.clear();

		for (const previewUrl of this.fullImagePreviewCache.values()) {
			URL.revokeObjectURL(previewUrl);
		}
		this.fullImagePreviewCache.clear();
	}
}
