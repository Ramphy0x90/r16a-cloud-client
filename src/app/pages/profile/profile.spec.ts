import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ProfilePage } from './profile';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { UserResponse } from '../../types/user';

describe('ProfilePage', () => {
	let component: ProfilePage;
	let fixture: ComponentFixture<ProfilePage>;

	const mockUser: UserResponse = {
		id: 'user-1',
		username: 'testuser',
		email: 'test@example.com',
		displayName: 'Test User',
		role: 'USER',
		preferences: {
			preferredTheme: 'light',
			defaultViewMode: 'grid',
		},
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	const updateCurrentUserPreferences = vi.fn(() => of(mockUser));
	const deleteCurrentUser = vi.fn(() => of(undefined as void));

	const userServiceMock = {
		currentUser$: of(mockUser),
		updateCurrentUserPreferences,
		deleteCurrentUser,
	};

	const authServiceMock = { logout: vi.fn() };

	const storeMock = {
		dispatch: vi.fn(),
	};

	beforeEach(async () => {
		updateCurrentUserPreferences.mockClear();
		storeMock.dispatch.mockClear();

		await TestBed.configureTestingModule({
			imports: [ProfilePage],
			providers: [
				provideRouter([]),
				{ provide: UserService, useValue: userServiceMock },
				{ provide: AuthService, useValue: authServiceMock },
				{ provide: Store, useValue: storeMock },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ProfilePage);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		fixture.destroy();
		vi.clearAllMocks();
	});

	it('should create', async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		expect(component).toBeTruthy();
	});

	it('should call updateCurrentUserPreferences after schedulePersist and debounce', async () => {
		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.loading$.value).toBe(false);

		component.preferredTheme = 'dark';
		component.schedulePersist();
		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(updateCurrentUserPreferences).toHaveBeenCalledTimes(1);
		expect(updateCurrentUserPreferences).toHaveBeenCalledWith({
			preferences: {
				preferredTheme: 'dark',
					defaultViewMode: 'grid',
			},
		});
		expect(storeMock.dispatch).toHaveBeenCalled();
	});

	it('links to the privacy policy', async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const link = (fixture.nativeElement as HTMLElement).querySelector('.legal-links a');
		expect(link?.textContent).toContain('Privacy policy');
		expect(link?.getAttribute('href')).toBe('/privacy');
	});

	describe('delete account', () => {
		beforeEach(async () => {
			fixture.detectChanges();
			await fixture.whenStable();
			component.openDeleteAccount();
		});

		it('only confirms once the exact word is typed', () => {
			expect(component.canConfirmDelete).toBe(false);
			component.deleteConfirmText = 'delete';
			expect(component.canConfirmDelete).toBe(false);
			component.deleteConfirmText = 'DELETE';
			expect(component.canConfirmDelete).toBe(true);
		});

		it('deletes, then signs out', async () => {
			component.deleteConfirmText = 'DELETE';

			component.confirmDeleteAccount();
			await fixture.whenStable();

			expect(deleteCurrentUser).toHaveBeenCalledTimes(1);
			expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
		});

		it('reports a failure and stays signed in', () => {
			deleteCurrentUser.mockReturnValueOnce(throwError(() => new Error('offline')));
			component.deleteConfirmText = 'DELETE';

			component.confirmDeleteAccount();

			expect(component.deleteError).toBe('Could not delete your account. Please try again.');
			expect(component.deleting).toBe(false);
			expect(authServiceMock.logout).not.toHaveBeenCalled();
		});
	});
});
