import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ProfilePage } from './profile';
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
			encryptFilesByDefault: false,
		},
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	const updateCurrentUserPreferences = vi.fn(() => of(mockUser));

	const userServiceMock = {
		currentUser$: of(mockUser),
		updateCurrentUserPreferences,
	};

	const storeMock = {
		dispatch: vi.fn(),
	};

	beforeEach(async () => {
		updateCurrentUserPreferences.mockClear();
		storeMock.dispatch.mockClear();

		await TestBed.configureTestingModule({
			imports: [ProfilePage],
			providers: [
				{ provide: UserService, useValue: userServiceMock },
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

		expect(component.loading).toBe(false);

		component.preferredTheme = 'dark';
		component.schedulePersist();
		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(updateCurrentUserPreferences).toHaveBeenCalledTimes(1);
		expect(updateCurrentUserPreferences).toHaveBeenCalledWith({
			preferences: {
				preferredTheme: 'dark',
				encryptFilesByDefault: false,
			},
		});
		expect(storeMock.dispatch).toHaveBeenCalled();
	});
});
