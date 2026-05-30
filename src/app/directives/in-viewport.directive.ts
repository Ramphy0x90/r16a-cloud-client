import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

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
