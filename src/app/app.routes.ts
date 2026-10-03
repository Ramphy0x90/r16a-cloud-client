import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard';
import { FilesPage } from './pages/files/files';
import { PhotosPage } from './pages/photos/photos';
import { ProfilePage } from './pages/profile/profile';
import { CallbackPage } from './pages/callback/callback';
import { PrivacyPage } from './pages/privacy/privacy';
import { authGuard } from './guards/auth.guard';
import { NavBarItem } from './types/nav-bar-item';

export const enum ROUTES {
	DASHBOARD = 'dashboard',
	FILES = 'files',
	PHOTOS = 'photos',
	PROFILE = 'profile',
	CALLBACK = 'callback',
	PRIVACY = 'privacy',
}

/** Pages anyone can open without signing in. */
export const PUBLIC_PATHS: readonly string[] = [`/${ROUTES.CALLBACK}`, `/${ROUTES.PRIVACY}`];

export const NAV_BAR_ROUTES: readonly NavBarItem[] = [
	{
		label: 'Dashboard',
		path: ROUTES.DASHBOARD,
		icon: 'bi-house',
	},
	{
		label: 'Files',
		longLabel: 'My files',
		path: ROUTES.FILES,
		icon: 'bi-cloud',
	},
	{
		label: 'Photos',
		longLabel: 'My photos',
		path: ROUTES.PHOTOS,
		icon: 'bi-images',
	},
	{
		label: 'Profile',
		longLabel: 'My profile',
		path: ROUTES.PROFILE,
		icon: 'bi-person',
	},
];

export const routes: Routes = [
	{ path: ROUTES.CALLBACK, component: CallbackPage },
	// Public: the app stores require a privacy policy URL reachable without an account.
	{ path: ROUTES.PRIVACY, component: PrivacyPage },
	{ path: '', pathMatch: 'full', redirectTo: ROUTES.DASHBOARD },
	{ path: ROUTES.DASHBOARD, component: DashboardPage, canActivate: [authGuard] },
	{ path: ROUTES.FILES, component: FilesPage, canActivate: [authGuard] },
	{ path: ROUTES.PHOTOS, component: PhotosPage, canActivate: [authGuard] },
	{ path: ROUTES.PROFILE, component: ProfilePage, canActivate: [authGuard] },
];
