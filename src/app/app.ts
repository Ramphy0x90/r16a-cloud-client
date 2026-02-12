import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { Header } from './components/header/header';
import { Store } from '@ngrx/store';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Theme } from './types/theme';
import { selectTheme } from './store/app/app.selector';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Component({
	selector: 'app-root',
	imports: [CommonModule, RouterOutlet, Header, NavBar],
	templateUrl: './app.html',
	styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
	protected readonly title = signal('r16a-cloud_client');

	private readonly oidc = inject(OidcSecurityService);
	private readonly store: Store = inject(Store);
	private readonly auth = inject(AuthService);

	readonly isAuthenticated$ = this.auth.isAuthenticated$;
	readonly currentTheme$: Observable<Theme> = this.store.select(selectTheme);
	readonly destroyed$: Subject<void> = new Subject();

	ngOnInit(): void {
		this.oidc.checkAuth().subscribe();

		this.currentTheme$.pipe(takeUntil(this.destroyed$)).subscribe((currentTheme) => {
			document.body.classList.remove('light-theme', 'dark-theme');
			document.body.classList.add(`${currentTheme}-theme`);
		});
	}

	ngOnDestroy(): void {
		this.destroyed$.next();
	}
}
