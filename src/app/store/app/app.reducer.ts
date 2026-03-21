import { createReducer, on } from '@ngrx/store';
import { UserPreferences } from '../../types/user';
import { clearUserPreferences, patchUserPreferences, setUserPreferences } from './app.actions';

export interface AppState {
	userPreferences: UserPreferences | null;
}

export function defaultUserPreferences(): UserPreferences {
	return {
		preferredTheme: 'light',
		encryptFilesByDefault: false,
		defaultViewMode: 'grid',
	};
}

function mergePreferences(
	current: UserPreferences | null,
	patch: Partial<UserPreferences>,
): UserPreferences {
	return {
		...defaultUserPreferences(),
		...(current ?? {}),
		...patch,
	};
}

export const initialState: AppState = {
	userPreferences: null,
};

export const appReducer = createReducer(
	initialState,
	on(setUserPreferences, (state, { preferences }) => ({
		...state,
		userPreferences: preferences,
	})),
	on(patchUserPreferences, (state, { patch }) => ({
		...state,
		userPreferences: mergePreferences(state.userPreferences, patch),
	})),
	on(clearUserPreferences, (state) => ({
		...state,
		userPreferences: null,
	})),
);
