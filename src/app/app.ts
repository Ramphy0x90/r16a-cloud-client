import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Theme } from './types/theme';
import { selectTheme } from './store/app/app.selector';
import { QuickSettings } from './components/quick-settings/quick-settings';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, NavBar, QuickSettings],
	templateUrl: './app.html',
	styleUrl: './app.css',
})
export class App implements OnInit {
	protected readonly title = signal('r16a-cloud_client');

	private readonly store: Store = inject(Store);

	readonly currentTheme$: Observable<Theme> = this.store.select(selectTheme);

	ngOnInit(): void {
		this.currentTheme$.subscribe((currentTheme) => {
			document.body.classList.remove('light-theme', 'dark-theme');
			document.body.classList.add(`${currentTheme}-theme`);
		});
	}
}
