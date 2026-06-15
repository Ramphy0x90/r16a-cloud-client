import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Emits (inViewport) each time the host element enters the extended viewport and
 * (outViewport) each time it exits. The observer stays alive for the lifetime of
 * the element so re-entries (e.g. scroll back up) are detected.
 *
 * rootMargin '400px': starts loading 400px before the element is visible so images
 * are fetched well before the user scrolls to them.
 */
@Directive({
	selector: '[inViewport]',
	standalone: true,
})
export class InViewportDirective implements OnInit, OnDestroy {
	@Output() inViewport = new EventEmitter<void>();
	@Output() outViewport = new EventEmitter<void>();

	private observer: IntersectionObserver | null = null;
	private hasEntered = false;

	constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

	ngOnInit(): void {
		if (typeof IntersectionObserver === 'undefined') {
			this.inViewport.emit();
			return;
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (!first) return;
				if (first.isIntersecting) {
					this.hasEntered = true;
					this.inViewport.emit();
				} else if (this.hasEntered) {
					this.outViewport.emit();
				}
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

}
