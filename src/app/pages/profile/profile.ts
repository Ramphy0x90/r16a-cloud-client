import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, debounceTime, finalize, switchMap, takeUntil } from 'rxjs';
import { UserService } from '../../services/user.service';
import { changeTheme } from '../../store/app/app.actions';
import { Theme } from '../../types/theme';
import { ToggleSwitch } from '../../components/toggle-switch/toggle-switch';
import { UserResponse } from '../../types/user';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';

@Component({
	selector: 'profile-page',
	imports: [CommonModule, FormsModule, ToggleSwitch, LoadingSpinner],
	templateUrl: './profile.html',
	styleUrl: './profile.css',
})
export class ProfilePage implements OnInit, OnDestroy {
	private readonly userService = inject(UserService);
	private readonly store: Store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroy$ = new Subject<void>();
	private readonly persistPreferences$ = new Subject<void>();

	readonly availableThemes: Theme[] = ['light', 'dark'];

	loading = true;
	saving = false;
	errorMessage: string | null = null;

	displayName = '';
	username = '';
	preferredTheme: Theme = 'light';
	encryptFilesByDefault = false;

	private preferencesHydrated = false;

	get userInitials(): string {
		const parts = this.displayName.trim().split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		return this.displayName.slice(0, 2).toUpperCase() || '?';
	}

	ngOnInit(): void {
		this.userService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe({
			next: (user) => this.setProfileState(user),
			error: () => {
				this.loading = false;
				this.errorMessage = 'Could not load profile details right now.';
				this.cdr.markForCheck();
			},
		});

		this.persistPreferences$
			.pipe(
				debounceTime(300),
				switchMap(() => {
					this.saving = true;
					this.errorMessage = null;
					this.cdr.markForCheck();
					return this.userService
						.updateCurrentUserPreferences({
							preferences: {
								preferredTheme: this.preferredTheme,
								encryptFilesByDefault: this.encryptFilesByDefault,
							},
						})
						.pipe(
							finalize(() => {
								this.saving = false;
								this.cdr.markForCheck();
							}),
						);
				}),
				takeUntil(this.destroy$),
			)
			.subscribe({
				next: (user) => {
					this.setProfileState(user);
					this.store.dispatch(changeTheme({ theme: user.preferences.preferredTheme }));
				},
				error: () => {
					this.errorMessage = 'Could not save preferences. Please try again.';
				},
			});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	schedulePersist(): void {
		if (!this.preferencesHydrated) return;
		this.persistPreferences$.next();
	}

	private setProfileState(user: UserResponse): void {
		this.displayName = user.displayName;
		this.username = user.username;
		this.preferredTheme = user.preferences.preferredTheme;
		this.encryptFilesByDefault = user.preferences.encryptFilesByDefault;
		this.loading = false;
		this.preferencesHydrated = true;
		this.cdr.markForCheck();
	}
}
