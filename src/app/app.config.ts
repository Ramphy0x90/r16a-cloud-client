import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor, OidcSecurityService, provideAuth } from 'angular-auth-oidc-client';
import { firstValueFrom, take } from 'rxjs';

import { routes } from './app.routes';
import { provideState, provideStore } from '@ngrx/store';
import { features } from './store/features';
import { appReducer } from './store/app/app.reducer';
import { fileReducer } from './store/file/file.reducer';
import { environment } from '../environments/environment';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes, withEnabledBlockingInitialNavigation()),
		provideAppInitializer(() => {
			const oidc = inject(OidcSecurityService);
			return firstValueFrom(oidc.checkAuth().pipe(take(1)));
		}),
		provideHttpClient(withInterceptors([authInterceptor()])),
		provideAuth({
			config: {
				authority: environment.oidc.authority,
				redirectUrl: environment.oidc.redirectUrl,
				postLogoutRedirectUri: environment.oidc.postLogoutRedirectUri,
				clientId: environment.oidc.clientId,
				scope: environment.oidc.scopes,
				checkRedirectUrlWhenCheckingIfIsCallback: false,
				responseType: 'code',
				silentRenew: true,
				useRefreshToken: true,
				allowUnsafeReuseRefreshToken: true,
				secureRoutes: [environment.apiUrl],
				unauthorizedRoute: '/callback',
			},
		}),
		provideStore(),
		provideState({ name: features.APP, reducer: appReducer }),
		provideState({ name: features.FILE, reducer: fileReducer }),
		provideServiceWorker('ngsw-worker.js', {
			enabled: !isDevMode(),
			registrationStrategy: 'registerWhenStable:30000',
		}),
	],
};
