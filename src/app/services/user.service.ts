import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, filter, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UpdateMyPreferencesRequest, UserPageResponse, UserResponse } from '../types/user';

@Injectable({ providedIn: 'root' })
export class UserService {
	private readonly http = inject(HttpClient);
	private readonly auth = inject(AuthService);
	private readonly apiUrl = `${environment.apiUrl}/user`;
	private readonly currentUserRefresh$ = new BehaviorSubject<void>(void 0);

	/** Get current authenticated user from backend (in the frontnend
	 * the "user" available is represented by the IdP, this one is the
	 * internal one
	 */
	readonly currentUser$: Observable<UserResponse> = this.auth.isAuthenticated$.pipe(
		filter((isAuth) => isAuth),
		switchMap(() => this.currentUserRefresh$),
		switchMap(() => this.http.get<UserResponse>(`${this.apiUrl}/me`)),
		shareReplay(1),
	);

	getUsers(page = 0, size = 200): Observable<UserPageResponse> {
		const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
		return this.http.get<UserPageResponse>(this.apiUrl, { params });
	}

	updateCurrentUserPreferences(request: UpdateMyPreferencesRequest): Observable<UserResponse> {
		return this.http.patch<UserResponse>(`${this.apiUrl}/me/preferences`, request).pipe(
			tap(() => this.refreshCurrentUser()),
		);
	}

	refreshCurrentUser(): void {
		this.currentUserRefresh$.next(void 0);
	}
}
