import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';

@Component({
	selector: 'callback-page',
	imports: [LoadingSpinner],
	template: `
		<div class="callback-container">
			<span>
				Signing you in
				<loading-spinner></loading-spinner>
			</span>
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

	ngOnInit(): void {
		this.auth.isAuthenticated$
			.pipe(
				filter((isAuthenticated) => isAuthenticated),
				take(1),
			)
			.subscribe(() => this.router.navigate(['/dashboard']));
	}
}
