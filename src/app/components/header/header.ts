import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { map, Observable } from 'rxjs';
import { getUserInitials } from '../../utils/user-utils';
import { Router } from '@angular/router';
import { ROUTES } from '../../app.routes';

@Component({
	selector: 'app-header',
	imports: [CommonModule],
	templateUrl: './header.html',
	styleUrl: './header.css',
})
export class Header {
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);

	readonly isAuthenticated$: Observable<boolean> = this.authService.isAuthenticated$;
	readonly userData$: Observable<Record<string, any>> = this.authService.userData$;
	readonly userInitials$: Observable<string> = this.userData$.pipe(
		map((user) => getUserInitials(user?.['name'] ?? '')),
	);

	toProfile(): void {
		this.router.navigate([ROUTES.PROFILE]);
	}
}
