import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Input, Output } from '@angular/core';
import { SortDirection, SortField, ViewMode } from '../../types/file';

@Component({
	selector: 'file-options',
	imports: [CommonModule],
	templateUrl: './file-options.html',
	styleUrl: './file-options.css',
})
export class FileOptions {
	private readonly el = inject(ElementRef);

	@Input() viewMode: ViewMode = 'grid';
	@Input() sortField: SortField = 'name';
	@Input() sortDirection: SortDirection = 'asc';
	@Input() selectionMode = false;

	@Output() viewModeChange = new EventEmitter<ViewMode>();
	@Output() sortFieldChange = new EventEmitter<SortField>();
	@Output() sortDirectionChange = new EventEmitter<SortDirection>();
	@Output() selectionModeChange = new EventEmitter<boolean>();

	isMenuOpen = false;

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: Event): void {
		if (!this.el.nativeElement.contains(event.target)) {
			this.isMenuOpen = false;
		}
	}

	toggleMenu(): void {
		this.isMenuOpen = !this.isMenuOpen;
	}

	setViewMode(mode: ViewMode): void {
		if (mode !== this.viewMode) {
			this.viewModeChange.emit(mode);
		}
	}

	setSortField(field: SortField): void {
		if (field === this.sortField) {
			this.sortDirectionChange.emit(this.sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			this.sortFieldChange.emit(field);
		}
	}

	toggleSelectionMode(): void {
		this.selectionModeChange.emit(!this.selectionMode);
		this.isMenuOpen = false;
	}
}
