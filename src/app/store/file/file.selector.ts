import { createFeatureSelector, createSelector } from '@ngrx/store';

import { features } from '../features';
import { FileState } from './file.reducer';

export const selectFileState = createFeatureSelector<FileState>(features.FILE);
export const selectFileToolbarState = createSelector(selectFileState, (state) => state.toolbar);
export const selectToolbarBreadcrumbs = createSelector(
	selectFileToolbarState,
	(state) => state.breadcrumbs,
);
export const selectToolbarSelectionMode = createSelector(
	selectFileToolbarState,
	(state) => state.selectionMode,
);
export const selectToolbarSelectedCount = createSelector(
	selectFileToolbarState,
	(state) => state.selectedCount,
);
export const selectToolbarViewMode = createSelector(selectFileToolbarState, (state) => state.viewMode);
export const selectToolbarSortField = createSelector(
	selectFileToolbarState,
	(state) => state.sortField,
);
export const selectToolbarSortDirection = createSelector(
	selectFileToolbarState,
	(state) => state.sortDirection,
);
