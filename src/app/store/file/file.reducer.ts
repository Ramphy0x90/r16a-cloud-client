import { createReducer, on } from '@ngrx/store';

import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { setFileToolbarState } from './file.actions';

export interface FileState {
	toolbar: {
		breadcrumbs: File[];
		selectionMode: boolean;
		selectedCount: number;
		viewMode: ViewMode;
		sortField: SortField;
		sortDirection: SortDirection;
	};
}

const initialToolbarState: FileState['toolbar'] = {
	breadcrumbs: [],
	selectionMode: false,
	selectedCount: 0,
	viewMode: 'grid',
	sortField: 'name',
	sortDirection: 'asc',
};

export const initialState: FileState = {
	toolbar: initialToolbarState,
};

export const fileReducer = createReducer(
	initialState,
	on(setFileToolbarState, (state, patch) => ({
		...state,
		toolbar: {
			...state.toolbar,
			...patch,
		},
	})),
);
