import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, filter, shareReplay, switchMap, take } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UserPageResponse, UserResponse } from '../types/user';

@Injectable({ providedIn: 'root' })
export class UserService {
	private readonly http = inject(HttpClient);
	private readonly auth = inject(AuthService);
	private readonly apiUrl = `${environment.apiUrl}/user`;

	/** Get current authenticated user from backend (in the frontnend
	 * the "user" available is represented by the IdP, this one is the
	 * internal one
	 */
	readonly currentUser$: Observable<UserResponse> = this.auth.isAuthenticated$.pipe(
		filter((isAuth) => isAuth),
		take(1),
		switchMap(() => this.http.get<UserResponse>(`${this.apiUrl}/me`)),
		shareReplay(1),
	);

	getUsers(page = 0, size = 200): Observable<UserPageResponse> {
		const params = new HttpParams().set('page', page.toString()).set('size', size.toString());
		return this.http.get<UserPageResponse>(this.apiUrl, { params });
	}
}
