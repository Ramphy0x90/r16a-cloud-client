import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
	selector: 'callback-page',
	template: `
		<div class="callback-container">
			<p>Signing you in...</p>
		</div>
	`,
	styles: `
		.callback-container {
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100%;
		}
	`,
})
export class CallbackPage implements OnInit {
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);

	ngOnInit(): void {
		this.auth.isAuthenticated$
			.pipe(
				filter((isAuthenticated) => isAuthenticated),
				take(1),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe(() => this.router.navigate(['/dashboard']));
	}
}
