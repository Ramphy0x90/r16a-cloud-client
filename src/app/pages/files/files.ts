import { Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	catchError,
	combineLatest,
	filter,
	forkJoin,
	from,
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
	toArray,
} from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { FileService } from '../../services/file.service';
import { UserService } from '../../services/user.service';
import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { ListView } from './list-view/list-view';
import { GridView } from './grid-view/grid-view';
import { FileOptions } from '../../components/file-options/file-options';

@Component({
	selector: 'files-page',
	imports: [CommonModule, FormsModule, ListView, GridView, FileOptions],
	templateUrl: './files.html',
	styleUrl: './files.css',
})
export class FilesPage implements OnDestroy {
	@ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

	private readonly fileService = inject(FileService);
	private readonly userService = inject(UserService);
	private readonly destroy$ = new Subject<void>();

	private readonly ownerId$: Observable<string> = this.userService.currentUser$.pipe(
		map((owner) => owner.id),
	);

	private readonly triggerFilesFetch$: Subject<void> = new Subject();

	readonly files$: Observable<File[]> = combineLatest([
		this.triggerFilesFetch$.pipe(startWith(void 0)),
		this.ownerId$,
	]).pipe(
		filter(([_, ownerId]) => ownerId != null),
		switchMap(([_, ownerId]) => {
			const parentId = this.currentFolder?.id ?? null;
			return this.fileService
				.getFiles(ownerId, parentId, this.sortField, this.sortDirection)
				.pipe(map((page) => page.content));
		}),
		shareReplay({ bufferSize: 1, refCount: true }),
		takeUntil(this.destroy$),
	);

	readonly imagePreviewUrls$: Observable<Map<string, string>> = this.files$.pipe(
		switchMap((files) => this.buildImagePreviewMap$(files)),
		startWith(new Map<string, string>()),
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

	private readonly imagePreviewCache = new Map<string, string>();
	readonly emptyImagePreviewMap = new Map<string, string>();

	newFolderName = '';
	renameName = '';

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
		this.triggerFilesFetch$.next();
	}

	onSortDirectionChange(direction: SortDirection): void {
		this.sortDirection = direction;
		this.triggerFilesFetch$.next();
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
		this.triggerFilesFetch$.next();
	}

	navigateToRoot(): void {
		this.breadcrumbs = [];
		this.currentFolder = null;
		this.selectedFile = null;
		this.cancelSelection();
		this.triggerFilesFetch$.next();
	}

	navigateToBreadcrumb(index: number): void {
		this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
		this.currentFolder = this.breadcrumbs[index] ?? null;
		this.selectedFile = null;
		this.cancelSelection();
		this.triggerFilesFetch$.next();
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
				next: () => this.triggerFilesFetch$.next(),
				error: (err) => {
					console.error('Failed to upload files:', err);
					this.triggerFilesFetch$.next();
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
					this.triggerFilesFetch$.next();
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
					this.triggerFilesFetch$.next();
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
					this.triggerFilesFetch$.next();
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
					this.triggerFilesFetch$.next();
				},
				error: (err) => {
					console.error('Failed to delete files:', err);
					this.showBulkDeleteConfirm = false;
					this.triggerFilesFetch$.next();
				},
			});
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
		this.showImagePreviewModal = true;
		this.imagePreviewFileName = file.name;
		this.imagePreviewFileId = file.id;
		this.imagePreviewUrl = this.imagePreviewCache.get(file.id) ?? null;
		this.imagePreviewLoading = this.imagePreviewUrl == null;

		if (this.imagePreviewLoading) {
			const preview = await lastValueFrom(this.ensureImagePreview$(file));
			this.imagePreviewUrl = preview?.[1] ?? null;
			this.imagePreviewLoading = false;
		}
	}

	private buildImagePreviewMap$(files: File[]): Observable<Map<string, string>> {
		const imageFiles = files.filter((file) => this.isImageFile(file));
		const validIds = new Set(imageFiles.map((file) => file.id));
		this.cleanupStaleImagePreviewUrls(validIds);

		if (imageFiles.length === 0) {
			return of(new Map());
		}

		return from(imageFiles).pipe(
			mergeMap((file) => this.ensureImagePreview$(file), 4),
			toArray(),
			map((entries) => {
				const mapWithValidUrls = new Map<string, string>();
				for (const entry of entries) {
					if (!entry) continue;
					mapWithValidUrls.set(entry[0], entry[1]);
				}
				return mapWithValidUrls;
			}),
		);
	}

	private ensureImagePreview$(file: File): Observable<[string, string] | null> {
		const existing = this.imagePreviewCache.get(file.id);
		if (existing) {
			return of([file.id, existing]);
		}

		return this.fileService.downloadFile(file.id).pipe(
			take(1),
			map((response) => {
				if (!response.body) return null;
				const previewUrl = URL.createObjectURL(response.body);
				this.imagePreviewCache.set(file.id, previewUrl);
				return [file.id, previewUrl] as [string, string];
			}),
			catchError((err) => {
				console.error('Failed to load image preview:', err);
				return of(null);
			}),
		);
	}

	private cleanupStaleImagePreviewUrls(validIds: Set<string>): void {
		for (const [fileId, previewUrl] of this.imagePreviewCache.entries()) {
			if (validIds.has(fileId)) continue;
			URL.revokeObjectURL(previewUrl);
			this.imagePreviewCache.delete(fileId);
			if (this.imagePreviewFileId === fileId) {
				this.closeImagePreviewModal();
			}
		}
	}

	private revokeAllImagePreviewUrls(): void {
		for (const previewUrl of this.imagePreviewCache.values()) {
			URL.revokeObjectURL(previewUrl);
		}
		this.imagePreviewCache.clear();
	}
}
