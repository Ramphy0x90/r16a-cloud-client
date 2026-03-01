import { ChangeDetectorRef, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	filter,
	forkJoin,
	lastValueFrom,
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
import { HttpResponse } from '@angular/common/http';
import { FileService } from '../../services/file.service';
import { FilesCacheService } from '../../services/files-cache.service';
import { UserService } from '../../services/user.service';
import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { ListView } from './list-view/list-view';
import { GridView } from './grid-view/grid-view';
import { FileOptions } from '../../components/file-options/file-options';

interface CachedImagePreview {
	url: string;
	expiresAt: number;
	lastAccessedAt: number;
}

@Component({
	selector: 'files-page',
	imports: [CommonModule, FormsModule, ListView, GridView, FileOptions],
	templateUrl: './files.html',
	styleUrl: './files.css',
})
export class FilesPage implements OnDestroy {
	@ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

	private readonly fileService = inject(FileService);
	private readonly filesCacheService = inject(FilesCacheService);
	private readonly userService = inject(UserService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroy$ = new Subject<void>();

	private readonly ownerId$: Observable<string> = this.userService.currentUser$.pipe(
		map((owner) => owner.id),
	);

	private readonly triggerFilesFetch$: Subject<void> = new Subject();
	private readonly imagePreviewLoadQueue$ = new Subject<File>();
	private readonly imagePreviewUrlsSubject = new BehaviorSubject<Map<string, string>>(new Map());

	private readonly thumbnailPreviewTtlMs = 5 * 60_000;
	private readonly maxThumbnailCacheSize = 400;

	readonly files$: Observable<File[]> = combineLatest([
		this.triggerFilesFetch$.pipe(startWith(void 0)),
		this.ownerId$,
	]).pipe(
		filter(([_, ownerId]) => ownerId != null),
		switchMap(([_, ownerId]) => {
			const parentId = this.currentFolder?.id ?? null;
			return this.filesCacheService.getFilesCached(ownerId, parentId, this.sortField, this.sortDirection);
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
	showImagePreviewModal = false;

	selectedFile: File | null = null;
	fileToDelete: File | null = null;
	fileToRename: File | null = null;
	imagePreviewFileName: string | null = null;
	imagePreviewFileId: string | null = null;
	imagePreviewUrl: string | null = null;
	imagePreviewLoading = false;
	private imagePreviewRequestVersion = 0;

	private readonly thumbnailPreviewCache = new Map<string, CachedImagePreview>();
	private readonly thumbnailPreviewInFlight = new Map<string, Observable<[string, string] | null>>();
	private readonly fullImagePreviewCache = new Map<string, string>();
	readonly emptyImagePreviewMap = new Map<string, string>();

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
	}

	ngOnDestroy(): void {
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

		if (this.isImageFile(file)) {
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
		const ownerId = await lastValueFrom(this.ownerId$);
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
		const ownerId = await lastValueFrom(this.ownerId$);

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

					const filename = this.extractDownloadFilename(response) ?? fallbackName;
					this.triggerBrowserDownload(response.body, filename);
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
		this.closeImagePreviewModal();
		this.fileToDelete = null;
		this.fileToRename = null;
	}

	closeImagePreviewModal(): void {
		this.imagePreviewRequestVersion += 1;
		this.showImagePreviewModal = false;
		this.imagePreviewLoading = false;
		this.imagePreviewFileName = null;
		this.imagePreviewFileId = null;
		this.imagePreviewUrl = null;
	}

	private extractDownloadFilename(response: HttpResponse<Blob>): string | null {
		const contentDisposition = response.headers.get('content-disposition');
		if (!contentDisposition) return null;

		const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
		if (encodedMatch?.[1]) {
			return decodeURIComponent(encodedMatch[1]);
		}

		const regularMatch = contentDisposition.match(/filename="([^"]+)"/i);
		return regularMatch?.[1] ?? null;
	}

	private triggerBrowserDownload(blob: Blob, filename: string): void {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}

	private isImageFile(file: File): boolean {
		if (file.isDirectory) return false;
		return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
	}

	private async openImagePreview(file: File): Promise<void> {
		const requestVersion = ++this.imagePreviewRequestVersion;
		this.showImagePreviewModal = true;
		this.imagePreviewFileName = file.name;
		this.imagePreviewFileId = file.id;
		this.imagePreviewUrl = this.fullImagePreviewCache.get(file.id) ?? null;
		this.imagePreviewLoading = this.imagePreviewUrl == null;
		this.cdr.detectChanges();

		if (!this.imagePreviewLoading) {
			return;
		}

		try {
			const preview = await lastValueFrom(this.ensureFullImagePreview$(file));
			if (requestVersion !== this.imagePreviewRequestVersion) {
				return;
			}
			this.imagePreviewUrl = preview?.[1] ?? null;
		} finally {
			if (requestVersion === this.imagePreviewRequestVersion) {
				this.imagePreviewLoading = false;
				this.cdr.detectChanges();
			}
		}
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

	private queueImagePreview(file: File): void {
		if (!this.isImageFile(file)) return;
		if (this.getThumbnailPreviewUrl(file.id)) return;
		if (this.thumbnailPreviewInFlight.has(file.id)) return;
		this.imagePreviewLoadQueue$.next(file);
	}

	private reconcileThumbnailCacheWithFiles(files: File[]): void {
		const imageFiles = files.filter((file) => this.isImageFile(file));
		const validIds = new Set(imageFiles.map((file) => file.id));
		this.cleanupStaleImagePreviewUrls(validIds);
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
			URL.revokeObjectURL(cached.url);
			this.thumbnailPreviewCache.delete(fileId);
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
			URL.revokeObjectURL(preview.url);
			this.thumbnailPreviewCache.delete(fileId);
		}
	}

	private cleanupStaleImagePreviewUrls(validIds: Set<string>): void {
		for (const [fileId, preview] of this.thumbnailPreviewCache.entries()) {
			if (validIds.has(fileId)) continue;
			URL.revokeObjectURL(preview.url);
			this.thumbnailPreviewCache.delete(fileId);
			if (this.imagePreviewFileId === fileId) {
				this.closeImagePreviewModal();
			}
		}
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
