import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuickSettings } from '../quick-settings/quick-settings';
import { AuthService } from '../../services/auth.service';
import { map, Observable } from 'rxjs';
import { getUserInitials } from '../../utils/user-utils';

@Component({
	selector: 'app-header',
	imports: [CommonModule, QuickSettings],
	templateUrl: './header.html',
	styleUrl: './header.css',
})
export class Header {
	private readonly authService = inject(AuthService);

	readonly isAuthenticated$: Observable<boolean> = this.authService.isAuthenticated$;
	readonly userData$: Observable<Record<string, any>> = this.authService.userData$;
	readonly userInitials$: Observable<string> = this.userData$.pipe(
		map((user) => getUserInitials(user?.['name'] ?? '')),
	);

	logout(): void {
		this.authService.logout();
	}
}
