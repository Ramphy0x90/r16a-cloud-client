import { Theme } from './theme';

export interface UserResponse {
	id: string;
	username: string;
	email: string;
	displayName: string;
	role: string;
	preferredTheme: Theme;
	encryptFilesByDefault: boolean;
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
	preferredTheme: Theme;
	encryptFilesByDefault: boolean;
}
