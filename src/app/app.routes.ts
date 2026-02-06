import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard';
import { FilesPage } from './pages/files/files';
import { SharedPage } from './pages/shared/shared';
import { ProfilePage } from './pages/profile/profile';
import { NavBarItem } from './types/nav-bar-item';

export const enum ROUTES {
	DASHBOARD = 'dashboard',
	FILES = 'files',
	SHARED = 'shared',
	PROFILE = 'profile',
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
		label: 'Shared',
		longLabel: 'Shared with me',
		path: ROUTES.SHARED,
		icon: 'bi-people',
	},
	{
		label: 'Profile',
		longLabel: 'My profile',
		path: ROUTES.PROFILE,
		icon: 'bi-person',
	},
];

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: ROUTES.DASHBOARD },
	{ path: ROUTES.DASHBOARD, component: DashboardPage },
	{ path: ROUTES.FILES, component: FilesPage },
	{ path: ROUTES.SHARED, component: SharedPage },
	{ path: ROUTES.PROFILE, component: ProfilePage },
];
