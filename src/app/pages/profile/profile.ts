import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable, Subject, debounceTime, switchMap, takeUntil } from 'rxjs';
import { UserService } from '../../services/user.service';
import { setUserPreferences } from '../../store/app/app.actions';
import { Theme } from '../../types/theme';
import { ViewMode } from '../../types/file';
import { UserResponse } from '../../types/user';
import { getUserInitials } from '../../utils/user-utils';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { AuthService } from '../../services/auth.service';

/** Typed to confirm account deletion — same word as the mobile app. */
export const DELETE_CONFIRMATION_WORD = 'DELETE';

@Component({
	selector: 'profile-page',
	imports: [CommonModule, FormsModule, RouterLink, LoadingSpinner],
	templateUrl: './profile.html',
	styleUrl: './profile.css',
})
export class ProfilePage implements OnInit, OnDestroy {
	private readonly authService = inject(AuthService);
	private readonly userService = inject(UserService);
	private readonly store: Store = inject(Store);
	private readonly persistPreferences$ = new Subject<void>();
	private readonly destroy$ = new Subject<void>();

	readonly availableThemes: Theme[] = ['light', 'dark'];
	readonly availableViewModes: ViewMode[] = ['grid', 'list'];

	loading$: BehaviorSubject<boolean> = new BehaviorSubject(true);
	errorMessage: string | null = null;

	displayName = '';
	username = '';
	preferredTheme: Theme = 'light';
	defaultViewMode: ViewMode = 'grid';

	private preferencesHydrated = false;

	readonly deleteConfirmationWord = DELETE_CONFIRMATION_WORD;
	deleteModalOpen = false;
	deleteConfirmText = '';
	deleting = false;
	deleteError: string | null = null;

	get userInitials(): string {
		return getUserInitials(this.displayName);
	}

	ngOnInit(): void {
		this.userService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe({
			next: (user) => this.setProfileState(user),
			error: () => {
				this.loading$.next(false);
				this.errorMessage = 'Could not load profile details right now.';
			},
		});

		// Automatic saving after user changes
		this.persistPreferences$
			.pipe(
				takeUntil(this.destroy$),
				debounceTime(300),
				switchMap(() => {
					this.errorMessage = null;
					return this.saveUserPreferences();
				}),
			)
			.subscribe({
				next: (user) => {
					this.setProfileState(user);
					this.store.dispatch(setUserPreferences({ preferences: user.preferences }));
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

	logout(): void {
		this.authService.logout();
	}

	openDeleteAccount(): void {
		this.deleteConfirmText = '';
		this.deleteError = null;
		this.deleteModalOpen = true;
	}

	closeDeleteAccount(): void {
		if (this.deleting) return;
		this.deleteModalOpen = false;
	}

	get canConfirmDelete(): boolean {
		return !this.deleting && this.deleteConfirmText.trim() === DELETE_CONFIRMATION_WORD;
	}

	/** Erases the account server-side, then signs out (which also clears local caches). */
	confirmDeleteAccount(): void {
		if (!this.canConfirmDelete) return;
		this.deleting = true;
		this.deleteError = null;
		this.userService.deleteCurrentUser().subscribe({
			next: () => {
				// The token must go: using it again would provision a fresh, empty account.
				void this.authService.logout();
			},
			error: () => {
				this.deleting = false;
				this.deleteError = 'Could not delete your account. Please try again.';
			},
		});
	}

	private saveUserPreferences(): Observable<UserResponse> {
		return this.userService.updateCurrentUserPreferences({
			preferences: {
				preferredTheme: this.preferredTheme,
				defaultViewMode: this.defaultViewMode,
			},
		});
	}

	private setProfileState(user: UserResponse): void {
		this.displayName = user.displayName;
		this.username = user.username;
		this.preferredTheme = user.preferences.preferredTheme;
		this.defaultViewMode = user.preferences.defaultViewMode;
		this.preferencesHydrated = true;
		this.loading$.next(false);
	}
}
