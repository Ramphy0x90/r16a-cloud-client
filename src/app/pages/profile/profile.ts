import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, take, takeUntil } from 'rxjs';
import { UserService } from '../../services/user.service';
import { changeTheme } from '../../store/app/app.actions';
import { Theme } from '../../types/theme';
import { ToggleSwitch } from '../../components/toggle-switch/toggle-switch';
import { UserResponse } from '../../types/user';

@Component({
	selector: 'profile-page',
	imports: [CommonModule, FormsModule, ToggleSwitch],
	templateUrl: './profile.html',
	styleUrl: './profile.css',
})
export class ProfilePage implements OnInit, OnDestroy {
	private readonly userService = inject(UserService);
	private readonly store: Store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroy$ = new Subject<void>();

	readonly availableThemes: Theme[] = ['light', 'dark'];

	loading = true;
	saving = false;
	errorMessage: string | null = null;
	successMessage: string | null = null;

	displayName = '';
	username = '';
	preferredTheme: Theme = 'light';
	encryptFilesByDefault = false;

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
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	savePreferences(): void {
		if (this.saving) return;

		this.saving = true;
		this.errorMessage = null;
		this.successMessage = null;

		this.userService
			.updateCurrentUserPreferences({
				preferredTheme: this.preferredTheme,
				encryptFilesByDefault: this.encryptFilesByDefault,
			})
			.pipe(take(1))
			.subscribe({
				next: (user) => {
					this.setProfileState(user);
					this.store.dispatch(changeTheme({ theme: user.preferredTheme }));
					this.successMessage = 'Preferences saved successfully.';
					this.saving = false;
				},
				error: () => {
					this.errorMessage = 'Could not save preferences. Please try again.';
					this.saving = false;
				},
			});
	}

	private setProfileState(user: UserResponse): void {
		this.displayName = user.displayName;
		this.username = user.username;
		this.preferredTheme = user.preferredTheme;
		this.encryptFilesByDefault = user.encryptFilesByDefault;
		this.loading = false;
		this.cdr.markForCheck();
	}
}
