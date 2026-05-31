import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Emits (inViewport) exactly once when the host element first enters the viewport,
 * then immediately disconnects its observer.
 *
 * Contrast with ScrollSentinelDirective, which keeps its observer alive and fires
 * on every scroll-past. That repeating pattern is needed for load-more pagination.
 * This one-shot pattern is for lazy-loading: once an image (or heavy component) has
 * been revealed there is no reason to keep observing it.
 *
 * hasEmitted guard: the IntersectionObserver callback can fire synchronously in some
 * environments before the disconnect() call below completes, so hasEmitted ensures
 * the output is truly emitted at most once regardless of timing.
 *
 * rootMargin '400px': starts loading 400px before the element is visible so images
 * are fetched well before the user scrolls to them (larger than ScrollSentinel's 200px
 * because a missed image render is more jarring than a slightly late batch load).
 */
@Directive({
	selector: '[inViewport]',
	standalone: true,
})
export class InViewportDirective implements OnInit, OnDestroy {
	@Output() inViewport = new EventEmitter<void>();

	private observer: IntersectionObserver | null = null;
	private hasEmitted = false;

	constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

	ngOnInit(): void {
		if (typeof IntersectionObserver === 'undefined') {
			this.emitOnce();
			return;
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (!first?.isIntersecting) return;
				this.emitOnce();
				this.observer?.disconnect();
				this.observer = null;
			},
			{
				root: null,
				rootMargin: '400px 0px',
				threshold: 0,
			},
		);

		this.observer.observe(this.elementRef.nativeElement);
	}

	ngOnDestroy(): void {
		this.observer?.disconnect();
		this.observer = null;
	}

	private emitOnce(): void {
		if (this.hasEmitted) return;
		this.hasEmitted = true;
		this.inViewport.emit();
	}
}
