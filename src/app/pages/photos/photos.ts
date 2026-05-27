import { ChangeDetectorRef, Component, ElementRef, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	BehaviorSubject,
	catchError,
	concat,
	debounceTime,
	fromEvent,
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
import { blurhashToDataUrl } from '../../utils/blurhash';
import { InViewportDirective } from '../../directives/in-viewport.directive';
import { ScrollSentinelDirective } from '../../directives/scroll-sentinel.directive';
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
	gridHeight: number;
}

@Component({
	selector: 'photos-page',
	imports: [CommonModule, InViewportDirective, ScrollSentinelDirective, ImagePreviewModal],
	templateUrl: './photos.html',
	styleUrl: './photos.css',
})
export class PhotosPage implements OnDestroy {
	private readonly photosService = inject(PhotosService);
	private readonly userService = inject(UserService);
	private readonly imagePreviewService = inject(ImagePreviewService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly el = inject(ElementRef);
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
		thumbnailUrl: null,
		blurHash: null,
		loading: false,
	});

	readonly imagePreviewState$ = this.imagePreviewStateSubject.asObservable();

	private readonly imagePreviewUrlsSubject = new BehaviorSubject<Map<string, string>>(new Map());
	readonly imagePreviewUrls$ = this.imagePreviewUrlsSubject.asObservable();
	readonly emptyPreviewMap = new Map<string, string>();

	yearSections: YearSection[] = [];
	loading = true;

	private getColumns(): number {
		// CSS breakpoints are viewport-width media queries, so column count
		// must be derived from window.innerWidth, not container width.
		const vw = window.innerWidth;
		if (vw >= 1200) return 6;
		if (vw >= 768) return 5;
		if (vw >= 480) return 4;
		return 3;
	}

	private computeGridHeight(totalCount: number): number {
		const cols = this.getColumns();
		// Item width uses the real rendered container (accounts for sidebar +
		// padding automatically). Falls back to viewport only if not yet in DOM.
		const containerWidth = (this.el.nativeElement as HTMLElement).clientWidth;
		if (!containerWidth) return 0;
		const gap = 2;
		const itemWidth = (containerWidth - gap * (cols - 1)) / cols;
		const rows = Math.ceil(totalCount / cols);
		return rows * itemWidth + Math.max(0, rows - 1) * gap;
	}

	@HostListener('window:resize')
	onResize(): void {
		this.yearSections = this.yearSections.map((s) => ({
			...s,
			gridHeight: this.computeGridHeight(s.totalCount),
		}));
		this.cdr.markForCheck();
	}

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
						thumbnailUrl: this.imagePreviewService.getThumbnailUrl(file.id),
						blurHash: file.blurHash,
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
						gridHeight: 0,
					}));
					this.loading = false;
					this.cdr.markForCheck();
					// clientWidth is 0 until Angular renders the host element.
					// One microtask later the layout is committed and we get real dimensions.
					setTimeout(() => this.onResize());
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
			thumbnailUrl: null,
			blurHash: null,
			loading: false,
		});
	}

	isVideoFile(photo: File): boolean {
		return isVideoFile(photo);
	}

	isImageFile(photo: File): boolean {
		return isImageFile(photo);
	}

	blurhashToDataUrl(hash: string): string {
		return blurhashToDataUrl(hash);
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
