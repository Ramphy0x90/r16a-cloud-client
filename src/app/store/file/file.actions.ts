import { createAction, props } from '@ngrx/store';

import { File, SortDirection, SortField, ViewMode } from '../../types/file';
import { features } from '../features';

export interface FileToolbarStatePayload {
	breadcrumbs: File[];
	selectionMode: boolean;
	selectedCount: number;
	viewMode: ViewMode;
	sortField: SortField;
	sortDirection: SortDirection;
}

export const setFileToolbarState = createAction(
	`[${features.FILE}] Set Toolbar State`,
	props<Partial<FileToolbarStatePayload>>(),
);

export const toolbarRootClicked = createAction(`[${features.FILE}] Toolbar Root Clicked`);
export const toolbarBreadcrumbClicked = createAction(
	`[${features.FILE}] Toolbar Breadcrumb Clicked`,
	props<{ index: number }>(),
);
export const toolbarShareClicked = createAction(`[${features.FILE}] Toolbar Share Clicked`);
export const toolbarRenameClicked = createAction(`[${features.FILE}] Toolbar Rename Clicked`);
export const toolbarDownloadClicked = createAction(`[${features.FILE}] Toolbar Download Clicked`);
export const toolbarBulkDeleteClicked = createAction(`[${features.FILE}] Toolbar Bulk Delete Clicked`);
export const toolbarCancelSelectionClicked = createAction(
	`[${features.FILE}] Toolbar Cancel Selection Clicked`,
);
export const toolbarCreateFolderClicked = createAction(
	`[${features.FILE}] Toolbar Create Folder Clicked`,
);
export const toolbarUploadClicked = createAction(`[${features.FILE}] Toolbar Upload Clicked`);
export const toolbarViewModeChanged = createAction(
	`[${features.FILE}] Toolbar View Mode Changed`,
	props<{ mode: ViewMode }>(),
);
export const toolbarSortFieldChanged = createAction(
	`[${features.FILE}] Toolbar Sort Field Changed`,
	props<{ field: SortField }>(),
);
export const toolbarSortDirectionChanged = createAction(
	`[${features.FILE}] Toolbar Sort Direction Changed`,
	props<{ direction: SortDirection }>(),
);
export const toolbarSelectionModeChanged = createAction(
	`[${features.FILE}] Toolbar Selection Mode Changed`,
	props<{ enabled: boolean }>(),
);
