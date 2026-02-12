import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor, provideAuth } from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { provideState, provideStore } from '@ngrx/store';
import { features } from './store/features';
import { appReducer } from './store/app/app.reducer';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
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
				unauthorizedRoute: '/login',
			},
		}),
		provideStore(),
		provideState({ name: features.APP, reducer: appReducer }),
	],
};
