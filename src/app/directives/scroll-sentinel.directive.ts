import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Emits (scrollSentinel) every time the host element enters the viewport.
 *
 * Contrast with InViewportDirective, which fires once then kills its observer.
 * That one-shot pattern works for lazy-loading images: you only need to know
 * "this image became visible once." But a load-more trigger needs to fire on
 * every scroll-past — once per batch — so the observer must stay alive.
 *
 * Cascade prevention: the sentinel stays in the DOM while hasMore is true
 * (no @if !loading toggle that would recreate it). If the observer fires while
 * a load is already in flight, loadMoreForYear()'s `if (section.loading) return`
 * guard silently drops the call. The observer only re-fires when the element
 * leaves and re-enters the detection zone, which requires the user to scroll
 * away — natural behavior, no runaway loop.
 *
 * rootMargin '200px': fires 200px before the element is actually visible so
 * the next batch is fetched before the user reaches the bottom.
 */
@Directive({
	selector: '[scrollSentinel]',
	standalone: true,
})
export class ScrollSentinelDirective implements OnInit, OnDestroy {
	@Output() scrollSentinel = new EventEmitter<void>();

	private observer: IntersectionObserver | null = null;

	constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

	ngOnInit(): void {
		if (typeof IntersectionObserver === 'undefined') {
			this.scrollSentinel.emit();
			return;
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					this.scrollSentinel.emit();
				}
			},
			{
				// Observe the browser viewport, not a specific container
				root: null,
				// Start fetching 200px before the sentinel is visible
				rootMargin: '200px 0px',
				// Fire as soon as 1px of the element enters the detection zone (rootMargin)
				threshold: 0,
			},
		);

		this.observer.observe(this.elementRef.nativeElement);
	}

	ngOnDestroy(): void {
		this.observer?.disconnect();
		this.observer = null;
	}
}
