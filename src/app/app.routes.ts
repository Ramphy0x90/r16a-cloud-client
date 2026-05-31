import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard';
import { FilesPage } from './pages/files/files';
import { PhotosPage } from './pages/photos/photos';
import { ProfilePage } from './pages/profile/profile';
import { CallbackPage } from './pages/callback/callback';
import { authGuard } from './guards/auth.guard';
import { NavBarItem } from './types/nav-bar-item';

export const enum ROUTES {
	DASHBOARD = 'dashboard',
	FILES = 'files',
	PHOTOS = 'photos',
	PROFILE = 'profile',
	CALLBACK = 'callback',
}

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
	{ path: '', pathMatch: 'full', redirectTo: ROUTES.DASHBOARD },
	{ path: ROUTES.DASHBOARD, component: DashboardPage, canActivate: [authGuard] },
	{ path: ROUTES.FILES, component: FilesPage, canActivate: [authGuard] },
	{ path: ROUTES.PHOTOS, component: PhotosPage, canActivate: [authGuard] },
	{ path: ROUTES.PROFILE, component: ProfilePage, canActivate: [authGuard] },
];
