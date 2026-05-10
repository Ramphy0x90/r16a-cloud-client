import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map, Observable } from 'rxjs';
import { ImagePreviewService } from './image-preview.service';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readonly oidc = inject(OidcSecurityService);
	private readonly imagePreviewService = inject(ImagePreviewService);

	readonly isAuthenticated$: Observable<boolean> = this.oidc.isAuthenticated$.pipe(
		map((result) => result.isAuthenticated),
	);

	readonly userData$: Observable<Record<string, any>> = this.oidc.userData$.pipe(
		map((result) => result.userData),
	);

	checkAuth(): Observable<boolean> {
		return this.oidc.checkAuth().pipe(map(({ isAuthenticated }) => isAuthenticated));
	}

	logout(): void {
		this.imagePreviewService.revokeAll();
		this.oidc.logoff().subscribe();
	}

	getAccessToken(): Observable<string> {
		return this.oidc.getAccessToken();
	}
}
