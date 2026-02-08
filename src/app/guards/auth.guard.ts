import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = () => {
	const oidc = inject(OidcSecurityService);
	const router = inject(Router);

	return oidc.isAuthenticated$.pipe(
		take(1),
		map(({ isAuthenticated }) => isAuthenticated || router.createUrlTree(['/login'])),
	);
};
