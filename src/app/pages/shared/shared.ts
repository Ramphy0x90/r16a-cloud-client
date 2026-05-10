import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy } from '@angular/core';
import {
	BehaviorSubject,
	filter,
	map,
	Observable,
	shareReplay,
	startWith,
	Subject,
	switchMap,
	take,
	takeUntil,
} from 'rxjs';
import { FileOptions } from '../../components/file-options/file-options';
import { GridView } from '../files/grid-view/grid-view';
import { ListView } from '../files/list-view/list-view';
import { ImagePreviewModal, ImagePreviewModalState } from '../files/image-preview-modal/image-preview-modal';
import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { Store } from '@ngrx/store';
import { FileService } from '../../services/file.service';
import { ImagePreviewService } from '../../services/image-preview.service';
import type { UserPreferences } from '../../types/user';
import { selectUserPreferences } from '../../store/app/app.selector';
import {
	extractDownloadFilename,
	isImageFile,
	triggerBrowserDownload,
} from '../../utils/file-utils';

@Component({
	selector: 'shared-page',
	imports: [CommonModule, FileOptions, GridView, ListView, ImagePreviewModal],
	templateUrl: './shared.html',
	styleUrl: './shared.css',
})
export class SharedPage implements OnDestroy {
	private readonly fileService = inject(FileService);
	private readonly store = inject(Store);
	private readonly imagePreviewService = inject(ImagePreviewService);
	private readonly destroy$ = new Subject<void>();
	private readonly triggerFilesFetch$ = new Subject<void>();
	private readonly imagePreviewUrlsSubject = new BehaviorSubject<Map<string, string>>(new Map());
	private readonly imagePreviewStateSubject = new BehaviorSubject<ImagePreviewModalState>({
		show: false,
		fileName: null,
		fileId: null,
		url: null,
		loading: false,
	});

	viewMode: ViewMode = 'grid';
	sortField: SortField = 'name';
	sortDirection: SortDirection = 'asc';
	selectedFile: File | null = null;
	readonly imagePreviewState$ = this.imagePreviewStateSubject.asObservable();
	readonly emptySelectedFileIds = new Set<string>();
	readonly emptyImagePreviewMap = new Map<string, string>();

	readonly files$: Observable<File[]> = this.triggerFilesFetch$.pipe(
		startWith(void 0),
		switchMap(() => this.fileService.getFilesSharedWithMe(this.sortField, this.sortDirection)),
		map((response) => response.content),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	readonly imagePreviewUrls$: Observable<Map<string, string>> =
		this.imagePreviewUrlsSubject.asObservable();

	constructor() {
		this.store
			.select(selectUserPreferences)
			.pipe(
				filter((p): p is UserPreferences => p !== null),
				take(1),
				takeUntil(this.destroy$),
			)
			.subscribe((prefs) => {
				this.viewMode = prefs.defaultViewMode;
			});
	}

	ngOnDestroy(): void {
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

	onFileClick(file: File): void {
		this.selectedFile = file;
		if (isImageFile(file)) {
			this.openImagePreview(file);
			return;
		}
		this.downloadFile(file);
	}

	onImageVisible(file: File): void {
		if (!isImageFile(file)) return;
		if (this.imagePreviewService.getThumbnailUrl(file.id)) return;

		this.imagePreviewService
			.ensureThumbnail$(file)
			.pipe(take(1))
			.subscribe((preview) => {
				if (!preview) return;
				const next = new Map(this.imagePreviewUrlsSubject.value);
				next.set(preview[0], preview[1]);
				this.imagePreviewUrlsSubject.next(next);
			});
	}

	closeImagePreview(): void {
		this.imagePreviewStateSubject.next({
			show: false,
			fileName: null,
			fileId: null,
			url: null,
			loading: false,
		});
	}

	private requestFilesRefresh(): void {
		this.triggerFilesFetch$.next();
	}

	private openImagePreview(file: File): void {
		const initialState: ImagePreviewModalState = {
			show: true,
			fileName: file.name,
			fileId: file.id,
			url: null,
			loading: true,
		};

		this.imagePreviewStateSubject.next(initialState);

		this.imagePreviewService
			.ensureFullPreview$(file)
			.pipe(take(1))
			.subscribe((preview) => {
				const current = this.imagePreviewStateSubject.value;
				if (!current.show || current.fileId !== file.id) return;
				this.imagePreviewStateSubject.next({
					...current,
					url: preview?.[1] ?? null,
					loading: false,
				});
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
					const filename = extractDownloadFilename(response) ?? fallbackName;
					triggerBrowserDownload(response.body, filename);
				},
				error: (err) => console.error('Failed to download shared file:', err),
			});
	}
}
