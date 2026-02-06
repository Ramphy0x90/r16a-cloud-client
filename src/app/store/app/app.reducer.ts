import { createReducer, on } from '@ngrx/store';
import { Theme } from '../../types/theme';
import { changeTheme } from './app.actions';

export interface AppState {
	theme: Theme;
}

export const initialState: AppState = {
	theme: 'light',
};

export const appReducer = createReducer(
	initialState,
	on(changeTheme, (state, prop) => ({
		...state,
		theme: prop.theme,
	})),
);
