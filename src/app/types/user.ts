import { ViewMode } from './file';
import { Theme } from './theme';

export interface UserPreferences {
	preferredTheme: Theme;
	encryptFilesByDefault: boolean;
	defaultViewMode: ViewMode;
}

export interface UserResponse {
	id: string;
	username: string;
	email: string;
	displayName: string;
	role: string;
	preferences: UserPreferences;
	createdAt: string;
	updatedAt: string;
}

export interface UserPageResponse {
	content: UserResponse[];
	totalElements: number;
	totalPages: number;
	size: number;
	number: number;
	first: boolean;
	last: boolean;
}

export interface UpdateMyPreferencesRequest {
	preferences: Partial<UserPreferences>;
}
