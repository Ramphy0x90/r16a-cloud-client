import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { Header } from './components/header/header';
import { Store } from '@ngrx/store';
import {
	combineLatest,
	distinctUntilChanged,
	filter,
	map,
	merge,
	Observable,
	of,
	Subject,
	takeUntil,
} from 'rxjs';
import { Theme } from './types/theme';
import { selectTheme } from './store/app/app.selector';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { UserService } from './services/user.service';
import { clearUserPreferences, setUserPreferences } from './store/app/app.actions';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';

@Component({
	selector: 'app-root',
	imports: [CommonModule, RouterOutlet, Header, NavBar, LoadingSpinner],
	templateUrl: './app.html',
	styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
	protected readonly title = signal('R16a Cloud');
	readonly menuOpen = signal(false);

	private readonly store: Store = inject(Store);
	private readonly auth = inject(AuthService);
	private readonly userService = inject(UserService);
	private readonly router = inject(Router);

	readonly isAuthenticated$ = this.auth.isAuthenticated$;
	readonly currentTheme$: Observable<Theme> = this.store.select(selectTheme);
	readonly destroyed$: Subject<void> = new Subject();

	/**
	 * Full-screen overlay while unauthenticated: OIDC `authorize()` runs from the route guard.
	 * Hides the app chrome so users do not briefly see the shell before the IdP redirect.
	 */
	readonly showRedirectOverlay$: Observable<boolean> = combineLatest([
		this.auth.isAuthenticated$,
		merge(
			of(this.router.url),
			this.router.events.pipe(
				filter((e): e is NavigationEnd => e instanceof NavigationEnd),
				map(() => this.router.url),
			),
		),
	]).pipe(
		map(([auth, url]) => !auth && !url.includes('/callback')),
		distinctUntilChanged(),
	);

	ngOnInit(): void {
		this.auth.isAuthenticated$.pipe(takeUntil(this.destroyed$)).subscribe((isAuthenticated) => {
			if (!isAuthenticated) {
				this.store.dispatch(clearUserPreferences());
			}
		});

		this.userService.currentUser$.pipe(takeUntil(this.destroyed$)).subscribe((user) => {
			this.store.dispatch(setUserPreferences({ preferences: user.preferences }));
		});

		this.currentTheme$.pipe(takeUntil(this.destroyed$)).subscribe((currentTheme) => {
			document.body.classList.remove('light-theme', 'dark-theme');
			document.body.classList.add(`${currentTheme}-theme`);
		});
	}

	ngOnDestroy(): void {
		this.destroyed$.next();
	}
}
