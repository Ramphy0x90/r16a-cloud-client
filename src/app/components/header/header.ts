import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuickSettings } from '../quick-settings/quick-settings';
import { AuthService } from '../../services/auth.service';
import { map, Observable } from 'rxjs';

@Component({
	selector: 'app-header',
	imports: [CommonModule, QuickSettings],
	templateUrl: './header.html',
	styleUrl: './header.css',
})
export class Header implements OnInit {
	private readonly aauthService = inject(AuthService);

	readonly isAuthenticated$: Observable<boolean> = this.aauthService.isAuthenticated$;
	readonly userData$: Observable<Record<string, any> | null> = this.aauthService.userData$;
	readonly userInitials$: Observable<string> = this.userData$.pipe(
		map((user) => {
			const tokens = user?.['name'].trim().split(/\s+/);

			if (tokens.length === 0) return '';
			if (tokens.length === 1) return tokens[0][0].toUpperCase();

			const firstInitial = tokens[0][0];
			const lastInitial = tokens[tokens.length - 1][0];

			return (firstInitial + lastInitial).toUpperCase();
		}),
	);

	ngOnInit(): void {
		this.aauthService.checkAuth().subscribe();
	}

	logout(): void {
		this.aauthService.logout();
	}
}
