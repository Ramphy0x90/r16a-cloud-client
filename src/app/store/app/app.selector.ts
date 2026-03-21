import { createFeatureSelector, createSelector } from '@ngrx/store';
import { Theme } from '../../types/theme';
import { AppState } from './app.reducer';
import { features } from '../features';

export const selectAppState = createFeatureSelector<AppState>(features.APP);

export const selectUserPreferences = createSelector(
	selectAppState,
	(state: AppState) => state.userPreferences,
);

export const selectTheme = createSelector(selectUserPreferences, (preferences): Theme => {
	return preferences?.preferredTheme ?? 'light';
});

export const selectDefaultViewMode = createSelector(selectUserPreferences, (preferences) => {
	return preferences?.defaultViewMode ?? 'grid';
});
