import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { File } from '../../types/file';

@Component({
	selector: 'breadcrumb',
	imports: [CommonModule],
	templateUrl: './breadcrumb.html',
	styleUrl: './breadcrumb.css',
})
export class Breadcrumb {
	@Input() items: File[] = [];

	@Output() rootClick = new EventEmitter<void>();
	@Output() itemClick = new EventEmitter<number>();

	onRootClick(): void {
		this.rootClick.emit();
	}

	onItemClick(index: number): void {
		this.itemClick.emit(index);
	}
}
