import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	BehaviorSubject,
	catchError,
	concat,
	map,
	mergeMap,
	Observable,
	of,
	Subject,
	switchMap,
	take,
	takeUntil,
} from 'rxjs';
import { PhotosService } from '../../services/photos.service';
import { UserService } from '../../services/user.service';
import { ImagePreviewService } from '../../services/image-preview.service';
import { File } from '../../types/file';
import { isImageFile, isVideoFile } from '../../utils/file-utils';
import { InViewportDirective } from '../../directives/in-viewport.directive';
import {
	ImagePreviewModal,
	ImagePreviewModalState,
} from '../files/image-preview-modal/image-preview-modal';

interface YearSection {
	year: number;
	totalCount: number;
	photos: File[];
	loading: boolean;
	hasMore: boolean;
	cursor: string | null;
	loadStarted: boolean;
}

@Component({
	selector: 'photos-page',
	imports: [CommonModule, InViewportDirective, ImagePreviewModal],
	templateUrl: './photos.html',
	styleUrl: './photos.css',
})
export class PhotosPage implements OnDestroy {
	private readonly photosService = inject(PhotosService);
	private readonly userService = inject(UserService);
	private readonly imagePreviewService = inject(ImagePreviewService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroy$ = new Subject<void>();

	private readonly ownerId$: Observable<string> = this.userService.currentUser$.pipe(
		map((user) => user.id),
	);

	private readonly imagePreviewLoadQueue$ = new Subject<File>();
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

	private readonly imagePreviewUrlsSubject = new BehaviorSubject<Map<string, string>>(new Map());
	readonly imagePreviewUrls$ = this.imagePreviewUrlsSubject.asObservable();
	readonly emptyPreviewMap = new Map<string, string>();
	readonly skeletonItems = Array(15).fill(0);

	yearSections: YearSection[] = [];
	loading = true;

	constructor() {
		this.imagePreviewLoadQueue$
			.pipe(
				mergeMap((file) => this.imagePreviewService.ensureThumbnail$(file), 6),
				takeUntil(this.destroy$),
			)
			.subscribe((preview) => {
				if (!preview) return;
				const next = new Map(this.imagePreviewUrlsSubject.value);
				next.set(preview[0], preview[1]);
				this.imagePreviewUrlsSubject.next(next);
				this.cdr.markForCheck();
			});

		this.imagePreviewOpen$
			.pipe(
				switchMap((file) => {
					const initial: ImagePreviewModalState = {
						show: true,
						fileName: file.name,
						fileId: file.id,
						url: null,
						loading: true,
					};
					return concat(
						of(initial),
						this.imagePreviewService.ensureFullPreview$(file).pipe(
							take(1),
							map((preview) => ({ ...initial, url: preview?.[1] ?? null, loading: false })),
						),
					).pipe(takeUntil(this.imagePreviewClose$));
				}),
				takeUntil(this.destroy$),
			)
			.subscribe((state) => this.imagePreviewStateSubject.next(state));

		this.ownerId$.pipe(take(1), takeUntil(this.destroy$)).subscribe((ownerId) => {
			this.photosService
				.getPhotoYears(ownerId)
				.pipe(take(1), catchError(() => of([])))
				.subscribe((years) => {
					this.yearSections = years.map((y) => ({
						year: y.year,
						totalCount: y.count,
						photos: [],
						loading: false,
						hasMore: false,
						cursor: null,
						loadStarted: false,
					}));
					this.loading = false;
					this.cdr.markForCheck();
				});
		});
	}

	ngOnDestroy(): void {
		this.imagePreviewClose$.next();
		this.destroy$.next();
		this.destroy$.complete();
	}

	onYearVisible(section: YearSection): void {
		if (section.loadStarted) return;
		section.loadStarted = true;
		this.loadPhotosForSection(section);
	}

	onPhotoVisible(photo: File): void {
		if (!isImageFile(photo)) return;
		const cached = this.imagePreviewService.getThumbnailUrl(photo.id);
		if (cached) {
			if (!this.imagePreviewUrlsSubject.value.has(photo.id)) {
				const next = new Map(this.imagePreviewUrlsSubject.value);
				next.set(photo.id, cached);
				this.imagePreviewUrlsSubject.next(next);
				this.cdr.markForCheck();
			}
			return;
		}
		this.imagePreviewLoadQueue$.next(photo);
	}

	openPhotoPreview(photo: File): void {
		if (!isImageFile(photo)) return;
		this.imagePreviewOpen$.next(photo);
	}

	loadMoreForYear(section: YearSection): void {
		if (!section.hasMore || section.loading) return;
		this.loadPhotosForSection(section);
	}

	closeImagePreview(): void {
		this.imagePreviewClose$.next();
		this.imagePreviewStateSubject.next({
			show: false,
			fileName: null,
			fileId: null,
			url: null,
			loading: false,
		});
	}

	isVideoFile(photo: File): boolean {
		return isVideoFile(photo);
	}

	isImageFile(photo: File): boolean {
		return isImageFile(photo);
	}

	private loadPhotosForSection(section: YearSection): void {
		section.loading = true;
		this.cdr.markForCheck();

		this.ownerId$
			.pipe(take(1))
			.subscribe((ownerId) => {
				this.photosService
					.getPhotos(ownerId, section.year, section.cursor)
					.pipe(take(1), catchError(() => of(null)))
					.subscribe((response) => {
						if (!response) {
							section.loading = false;
							this.cdr.markForCheck();
							return;
						}
						section.photos = [...section.photos, ...response.content];
						section.hasMore = response.hasMore;
						section.cursor = response.nextCursor;
						section.loading = false;
						this.cdr.markForCheck();
					});
			});
	}
}
