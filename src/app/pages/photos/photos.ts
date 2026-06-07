import {
	ChangeDetectorRef,
	Component,
	ElementRef,
	HostListener,
	inject,
	OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	BehaviorSubject,
	catchError,
	concat,
	forkJoin,
	map,
	Observable,
	of,
	Subject,
	switchMap,
	take,
	takeUntil,
} from 'rxjs';
import { PhotosService } from '../../services/photos.service';
import { FileService } from '../../services/file.service';
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
import { YearSection } from '../../types/photo';

@Component({
	selector: 'photos-page',
	imports: [CommonModule, InViewportDirective, ScrollSentinelDirective, ImagePreviewModal],
	templateUrl: './photos.html',
	styleUrl: './photos.css',
})
export class PhotosPage implements OnDestroy {
	private readonly MAX_PARALLEL_THUMBNAIL_FETCH = 6;

	private pendingThumbnails: File[] = [];
	private activeFetches = 0;

	private readonly photosService = inject(PhotosService);
	private readonly fileService = inject(FileService);
	private readonly userService = inject(UserService);
	private readonly imagePreviewService = inject(ImagePreviewService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly el = inject(ElementRef);
	private readonly destroy$ = new Subject<void>();

	private readonly ownerId$: Observable<string> = this.userService.currentUser$.pipe(
		map((user) => user.id),
	);

	/**
	 * Used for the first loading of the photos based on current
	 * user, this after this loading the years, structure etc is
	 * available to start rendering stuff.
	 */
	readonly loading$: BehaviorSubject<boolean> = new BehaviorSubject(true);

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

	private readonly imagePreviewUrlsSubject$ = new BehaviorSubject<Map<string, string>>(new Map());
	readonly imagePreviewUrls$ = this.imagePreviewUrlsSubject$.asObservable();
	readonly emptyPreviewMap = new Map<string, string>();

	private get columnsCount(): number {
		// CSS breakpoints are viewport-width media queries, so column count
		// must be derived from window.innerWidth, not container width.
		const vw = window.innerWidth;
		if (vw >= 1200) return 6;
		if (vw >= 768) return 5;
		if (vw >= 480) return 4;
		return 3;
	}

	yearSections: YearSection[] = [];
	sharedPhotoIds = new Set<string>();

	constructor() {
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
			forkJoin({
				years: this.photosService.getPhotoYears(ownerId).pipe(catchError(() => of([]))),
				shared: this.fileService.getFilesSharedWithMe('name', 'asc', 0, 500).pipe(
					map((r) => r.content.filter((f) => isImageFile(f) || isVideoFile(f))),
					catchError(() => of([])),
				),
			})
				.pipe(take(1))
				.subscribe(({ years, shared }) => {
					// Index shared photos by year derived from takenAt or createdAt
					const sharedByYear = new Map<number, File[]>();
					for (const photo of shared) {
						const dateStr = photo.takenAt ?? photo.createdAt;
						const year = parseInt(dateStr.substring(0, 4), 10);
						if (!sharedByYear.has(year)) sharedByYear.set(year, []);
						sharedByYear.get(year)!.push(photo);
						this.sharedPhotoIds.add(photo.id);
					}

					// Build year set from own photos, then add years only in shared
					const ownYearSet = new Set(years.map((y) => y.year));
					const allYears = [...new Set([...ownYearSet, ...sharedByYear.keys()])].sort(
						(a, b) => b - a,
					);

					this.yearSections = allYears.map((year) => {
						const ownEntry = years.find((y) => y.year === year);
						const sharedPhotos = sharedByYear.get(year) ?? [];
						const ownCount = ownEntry?.count ?? 0;
						return {
							year,
							totalCount: ownCount + sharedPhotos.length,
							// Pre-populate with shared photos; own photos append lazily
							photos: sharedPhotos,
							// No own photos for this year → nothing to lazy-load
							hasMore: false,
							cursor: null,
							gridHeight: 0,
							loadStarted$: new BehaviorSubject(ownCount === 0),
							loading$: new BehaviorSubject(false),
						};
					});

					this.loading$.next(false);

					// clientWidth is 0 until Angular renders the host element.
					// One microtask later the layout is committed and we get real dimensions.
					setTimeout(() => {
						this.onResize();
						// All sections start collapsed (header height only), so many stack
						// within the initial viewport and IntersectionObserver may miss them
						// all in one burst — especially on mobile where the browser can
						// throttle IO callbacks. Eagerly start visible sections without
						// waiting for the observer.
						this.triggerInitialSections();
					});
				});
		});
	}

	ngOnDestroy(): void {
		this.imagePreviewClose$.next();
		this.destroy$.next();
		this.destroy$.complete();
	}

	@HostListener('window:resize')
	onResize(): void {
		this.yearSections = this.yearSections.map((s) => ({
			...s,
			gridHeight: this.computeGridHeight(s.totalCount),
		}));
		this.cdr.markForCheck();
	}

	onYearVisible(section: YearSection): void {
		if (section.loadStarted$.getValue()) return;
		section.loadStarted$.next(true);
		this.loadPhotosForSection(section);
	}

	onPhotoVisible(photo: File): void {
		// For now, only show thumbnail for photos and videos
		if (!isImageFile(photo) && !isVideoFile(photo)) return;

		const cached = this.imagePreviewService.getThumbnailUrl(photo.id);
		if (cached) {
			if (!this.imagePreviewUrlsSubject$.value.has(photo.id)) {
				const next = new Map(this.imagePreviewUrlsSubject$.value);
				next.set(photo.id, cached);
				this.imagePreviewUrlsSubject$.next(next);
			}
			return;
		}
		this.enqueueThumbnail(photo);
	}

	openPhotoPreview(photo: File): void {
		if (!isImageFile(photo)) return;
		this.imagePreviewOpen$.next(photo);
	}

	loadMoreForYear(section: YearSection): void {
		if (!section.hasMore || section.loading$.getValue()) return;
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

	private enqueueThumbnail(file: File): void {
		if (this.pendingThumbnails.some((f) => f.id === file.id)) return;
		this.pendingThumbnails.unshift(file);
		this.drainThumbnailQueue();
	}

	private drainThumbnailQueue(): void {
		while (
			this.activeFetches < this.MAX_PARALLEL_THUMBNAIL_FETCH &&
			this.pendingThumbnails.length
		) {
			const file = this.pendingThumbnails.shift()!;
			this.activeFetches++;

			this.imagePreviewService
				.ensureThumbnail$(file)
				.pipe(take(1), takeUntil(this.destroy$))
				.subscribe((preview) => {
					this.activeFetches--;
					if (preview) {
						const next = new Map(this.imagePreviewUrlsSubject$.value);
						next.set(preview[0], preview[1]);
						this.imagePreviewUrlsSubject$.next(next);
					}
					this.drainThumbnailQueue();
				});
		}
	}

	private triggerInitialSections(): void {
		const container = this.el.nativeElement as HTMLElement;
		// Walk up to find the actual scroll container (.pages-render-space).
		// Falls back to window.innerHeight if no scrolling ancestor is found.
		let scrollAncestor: Element | null = container.parentElement;
		while (scrollAncestor) {
			const style = getComputedStyle(scrollAncestor);
			if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
			scrollAncestor = scrollAncestor.parentElement;
		}
		const visibleHeight = scrollAncestor ? scrollAncestor.clientHeight : window.innerHeight;

		// Compute how many sections fit in the initial unscrolled view.
		// Each collapsed section is roughly its header height; use a generous
		// estimate (80px) so we never under-count on large-font or zoomed screens.
		const headerEstimate = 80;
		const sectionsInView = Math.max(1, Math.ceil(visibleHeight / headerEstimate));

		this.yearSections.slice(0, sectionsInView).forEach((s) => this.onYearVisible(s));
		this.cdr.markForCheck();
	}

	private computeGridHeight(totalCount: number): number {
		const cols = this.columnsCount;
		// Item width uses the real rendered container (accounts for sidebar +
		// padding automatically). Falls back to viewport only if not yet in DOM.
		const containerWidth = (this.el.nativeElement as HTMLElement).clientWidth;
		if (!containerWidth) return 0;
		const gap = 2;
		const itemWidth = (containerWidth - gap * (cols - 1)) / cols;
		const rows = Math.ceil(totalCount / cols);
		return rows * itemWidth + Math.max(0, rows - 1) * gap;
	}

	private loadPhotosForSection(section: YearSection): void {
		section.loading$.next(true);

		this.ownerId$.pipe(take(1)).subscribe((ownerId) => {
			this.photosService
				.getPhotos(ownerId, section.year, section.cursor)
				.pipe(
					take(1),
					catchError(() => of(null)),
				)
				.subscribe((response) => {
					if (!response) {
						section.loading$.next(false);
						return;
					}

					// Keep pre-populated shared photos at the end; own photos prepend
					const sharedPhotos = section.photos.filter((p) => this.sharedPhotoIds.has(p.id));
					section.photos = [
						...section.photos.filter((p) => !this.sharedPhotoIds.has(p.id)),
						...response.content,
						...sharedPhotos,
					];
					section.hasMore = response.hasMore;
					section.cursor = response.nextCursor;
					section.loading$.next(false);
				});
		});
	}
}
