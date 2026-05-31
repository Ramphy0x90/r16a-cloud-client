import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import { Breadcrumb } from '../breadcrumb/breadcrumb';
import { FileOptions } from '../file-options/file-options';
import {
	toolbarBreadcrumbClicked,
	toolbarBulkDeleteClicked,
	toolbarCancelSelectionClicked,
	toolbarCreateFolderClicked,
	toolbarDownloadClicked,
	toolbarRenameClicked,
	toolbarRootClicked,
	toolbarSelectionModeChanged,
	toolbarShareClicked,
	toolbarSortDirectionChanged,
	toolbarSortFieldChanged,
	toolbarUploadClicked,
	toolbarViewModeChanged,
} from '../../store/file/file.actions';
import {
	selectToolbarBreadcrumbs,
	selectToolbarSelectedCount,
	selectToolbarSelectionMode,
	selectToolbarSortDirection,
	selectToolbarSortField,
	selectToolbarViewMode,
} from '../../store/file/file.selector';
import { SortDirection, SortField, ViewMode } from '../../types/file';

@Component({
	selector: 'files-toolbar',
	imports: [CommonModule, Breadcrumb, FileOptions],
	templateUrl: './files-toolbar.html',
	styleUrl: './files-toolbar.css',
})
export class FilesToolbar {
	@Input() readOnly = false;
	@Input() sharedFilter = false;
	@Output() sharedFilterChange = new EventEmitter<boolean>();

	private readonly store = inject(Store);

	readonly breadcrumbs = toSignal(this.store.select(selectToolbarBreadcrumbs), { initialValue: [] });
	readonly selectionMode = toSignal(this.store.select(selectToolbarSelectionMode), {
		initialValue: false,
	});
	readonly selectedCount = toSignal(this.store.select(selectToolbarSelectedCount), {
		initialValue: 0,
	});
	readonly viewMode = toSignal(this.store.select(selectToolbarViewMode), { initialValue: 'grid' });
	readonly sortField = toSignal(this.store.select(selectToolbarSortField), { initialValue: 'name' });
	readonly sortDirection = toSignal(this.store.select(selectToolbarSortDirection), {
		initialValue: 'asc',
	});

	onRootClick(): void {
		this.store.dispatch(toolbarRootClicked());
	}

	onBreadcrumbClick(index: number): void {
		this.store.dispatch(toolbarBreadcrumbClicked({ index }));
	}

	onViewModeChange(mode: ViewMode): void {
		this.store.dispatch(toolbarViewModeChanged({ mode }));
	}

	onSortFieldChange(field: SortField): void {
		this.store.dispatch(toolbarSortFieldChanged({ field }));
	}

	onSortDirectionChange(direction: SortDirection): void {
		this.store.dispatch(toolbarSortDirectionChanged({ direction }));
	}

	onSelectionModeChange(enabled: boolean): void {
		this.store.dispatch(toolbarSelectionModeChanged({ enabled }));
	}

	onShareSelected(): void {
		this.store.dispatch(toolbarShareClicked());
	}

	onRenameSelected(): void {
		this.store.dispatch(toolbarRenameClicked());
	}

	onDownloadSelected(): void {
		this.store.dispatch(toolbarDownloadClicked());
	}

	onBulkDeleteSelected(): void {
		this.store.dispatch(toolbarBulkDeleteClicked());
	}

	onCancelSelection(): void {
		this.store.dispatch(toolbarCancelSelectionClicked());
	}

	onCreateFolder(): void {
		this.store.dispatch(toolbarCreateFolderClicked());
	}

	onUpload(): void {
		this.store.dispatch(toolbarUploadClicked());
	}
}
