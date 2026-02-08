import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, map, shareReplay } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readonly oidc = inject(OidcSecurityService);

	readonly isAuthenticated$: Observable<boolean> = this.oidc.isAuthenticated$.pipe(
		map(({ isAuthenticated }) => isAuthenticated),
		shareReplay(1),
	);

	readonly userData$: Observable<Record<string, string> | null> = this.oidc.userData$.pipe(
		map(({ userData }) => userData ?? null),
		shareReplay(1),
	);

	checkAuth(): Observable<boolean> {
		return this.oidc.checkAuth().pipe(map(({ isAuthenticated }) => isAuthenticated));
	}

	login(): void {
		this.oidc.authorize();
	}

	logout(): void {
		this.oidc.logoff().subscribe();
	}

	getAccessToken(): Observable<string> {
		return this.oidc.getAccessToken();
	}
}
