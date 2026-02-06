import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ToggleSwitch } from '../toggle-switch/toggle-switch';
import { map, Observable } from 'rxjs';
import { Theme } from '../../types/theme';
import { selectTheme } from '../../store/app/app.selector';
import { changeTheme } from '../../store/app/app.actions';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
	selector: 'quick-settings',
	imports: [CommonModule, FormsModule, ToggleSwitch],
	templateUrl: './quick-settings.html',
	styleUrl: './quick-settings.css',
})
export class QuickSettings {
	private readonly store: Store = inject(Store);
	readonly currentThemeBoolean$: Observable<boolean> = this.store
		.select(selectTheme)
		.pipe(map((currentTheme) => currentTheme === 'light'));

	isSettingsMenuVisible: boolean = false;

	toggleSettingsMenu(): void {
		this.isSettingsMenuVisible = !this.isSettingsMenuVisible;
	}

	toggleTheme(themeBoolean: boolean): void {
		if (themeBoolean) this.setDarkTheme();
		else this.setLightTheme();
	}

	private setLightTheme(): void {
		this.store.dispatch(changeTheme({ theme: 'light' }));
	}

	private setDarkTheme(): void {
		this.store.dispatch(changeTheme({ theme: 'dark' }));
	}
}
