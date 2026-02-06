import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppState } from './app.reducer';
import { features } from '../features';

export const selectAppState = createFeatureSelector<AppState>(features.APP);
export const selectTheme = createSelector(selectAppState, (state: AppState) => state.theme);
