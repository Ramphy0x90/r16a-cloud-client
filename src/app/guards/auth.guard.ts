import { inject } from '@angular/core';
import { type CanActivateFn } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map, take, tap } from 'rxjs';

export const authGuard: CanActivateFn = () => {
	const oidc = inject(OidcSecurityService);

	return oidc.checkAuth().pipe(
		take(1),
		tap(({ isAuthenticated }) => {
			if (!isAuthenticated) {
				oidc.authorize();
			}
		}),
		map(({ isAuthenticated }) => isAuthenticated),
	);
};
