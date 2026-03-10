import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, startWith, Subject, switchMap, take } from 'rxjs';
import { FileOptions } from '../../components/file-options/file-options';
import { GridView } from '../files/grid-view/grid-view';
import { ListView } from '../files/list-view/list-view';
import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { FileService } from '../../services/file.service';
import { HttpResponse } from '@angular/common/http';

@Component({
	selector: 'shared-page',
	imports: [CommonModule, FileOptions, GridView, ListView],
	templateUrl: './shared.html',
	styleUrl: './shared.css',
})
export class SharedPage implements OnDestroy {
	private readonly fileService = inject(FileService);
	private readonly triggerFilesFetch$ = new Subject<void>();
	private readonly imagePreviewUrlsSubject = new Subject<Map<string, string>>();

	viewMode: ViewMode = 'grid';
	sortField: SortField = 'name';
	sortDirection: SortDirection = 'asc';
	selectedFile: File | null = null;
	showImagePreviewModal = false;
	imagePreviewName: string | null = null;
	imagePreviewUrl: string | null = null;
	imagePreviewLoading = false;

	readonly files$: Observable<File[]> = this.triggerFilesFetch$.pipe(
		startWith(void 0),
		switchMap(() => this.fileService.getFilesSharedWithMe(this.sortField, this.sortDirection)),
		map((response) => response.content),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	readonly imagePreviewUrls$: Observable<Map<string, string>> = this.imagePreviewUrlsSubject.pipe(
		startWith(new Map<string, string>()),
		shareReplay({ bufferSize: 1, refCount: true }),
	);
	readonly emptySelectedFileIds = new Set<string>();
	readonly emptyImagePreviewMap = new Map<string, string>();
	private readonly thumbnailUrls = new Map<string, string>();
	private readonly fullPreviewUrls = new Map<string, string>();
	private readonly thumbnailInFlight = new Set<string>();

	ngOnDestroy(): void {
		for (const url of this.thumbnailUrls.values()) {
			URL.revokeObjectURL(url);
		}
		this.thumbnailUrls.clear();

		for (const url of this.fullPreviewUrls.values()) {
			URL.revokeObjectURL(url);
		}
		this.fullPreviewUrls.clear();
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

	onFileClick(file: File): void {
		this.selectedFile = file;
		if (this.isImageFile(file)) {
			this.openImagePreview(file);
			return;
		}
		this.downloadFile(file);
	}

	onImageVisible(file: File): void {
		if (!this.isImageFile(file)) return;
		if (this.thumbnailUrls.has(file.id) || this.thumbnailInFlight.has(file.id)) return;

		this.thumbnailInFlight.add(file.id);
		this.fileService
			.downloadThumbnail(file.id, 'small')
			.pipe(take(1))
			.subscribe({
				next: (response) => {
					if (!response.body) return;
					const url = URL.createObjectURL(response.body);
					this.thumbnailUrls.set(file.id, url);
					const next = new Map(this.thumbnailUrls);
					this.imagePreviewUrlsSubject.next(next);
				},
				error: (err) => console.error('Failed to load shared image thumbnail:', err),
				complete: () => this.thumbnailInFlight.delete(file.id),
			});
	}

	closeImagePreview(): void {
		this.showImagePreviewModal = false;
		this.imagePreviewName = null;
		this.imagePreviewUrl = null;
		this.imagePreviewLoading = false;
	}

	private requestFilesRefresh(): void {
		this.triggerFilesFetch$.next();
	}

	private isImageFile(file: File): boolean {
		if (file.isDirectory) return false;
		return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
	}

	private openImagePreview(file: File): void {
		this.showImagePreviewModal = true;
		this.imagePreviewName = file.name;
		const cached = this.fullPreviewUrls.get(file.id) ?? null;
		if (cached) {
			this.imagePreviewUrl = cached;
			this.imagePreviewLoading = false;
			return;
		}

		this.imagePreviewUrl = null;
		this.imagePreviewLoading = true;
		this.fileService
			.downloadFile(file.id)
			.pipe(
				take(1),
				catchError((err) => {
					console.error('Failed to load shared image preview:', err);
					return of(null);
				}),
			)
			.subscribe((response) => {
				if (!response?.body) {
					this.imagePreviewLoading = false;
					return;
				}
				const url = URL.createObjectURL(response.body);
				this.fullPreviewUrls.set(file.id, url);
				this.imagePreviewUrl = url;
				this.imagePreviewLoading = false;
			});
	}

	private downloadFile(file: File): void {
		this.fileService
			.downloadFile(file.id)
			.pipe(take(1))
			.subscribe({
				next: (response) => {
					if (!response.body) return;
					const fallbackName = file.isDirectory ? `${file.name}.zip` : file.name;
					const filename = this.extractDownloadFilename(response) ?? fallbackName;
					this.triggerBrowserDownload(response.body, filename);
				},
				error: (err) => console.error('Failed to download shared file:', err),
			});
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
}
