import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map, Observable } from 'rxjs';
import { FilesCacheService } from './files-cache.service';
import { ImagePreviewService } from './image-preview.service';

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private readonly oidc = inject(OidcSecurityService);
	private readonly imagePreviewService = inject(ImagePreviewService);
	private readonly filesCache = inject(FilesCacheService);

	readonly isAuthenticated$: Observable<boolean> = this.oidc.isAuthenticated$.pipe(
		map((result) => result.isAuthenticated),
	);

	readonly userData$: Observable<Record<string, any>> = this.oidc.userData$.pipe(
		map((result) => result.userData),
	);

	checkAuth(): Observable<boolean> {
		return this.oidc.checkAuth().pipe(map(({ isAuthenticated }) => isAuthenticated));
	}

	/**
	 * Clears everything cached in this browser for the signed-in user (listings in memory and
	 * IndexedDB, thumbnails) before the IdP redirect, so the next person on this browser can't
	 * read file names from the cache.
	 */
	async logout(): Promise<void> {
		this.imagePreviewService.revokeAll();
		try {
			await this.filesCache.clearAll();
		} catch {
			// Storage unavailable: nothing persisted to clear.
		}
		this.oidc.logoff().subscribe();
	}

	getAccessToken(): Observable<string> {
		return this.oidc.getAccessToken();
	}
}
