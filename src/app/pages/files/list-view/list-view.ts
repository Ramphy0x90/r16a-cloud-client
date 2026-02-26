import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { File } from '../../../types/file';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';

@Component({
	selector: 'list-view',
	imports: [CommonModule, IconFromExtensionPipe],
	templateUrl: './list-view.html',
	styleUrl: './list-view.css',
})
export class ListView {
	@Input() files$: Observable<File[]> = of([]);
	@Input() selectedFile: File | null = null;
	@Input() selectionMode = false;
	@Input() selectedFileIds: Set<string> = new Set();

	@Output() fileClick = new EventEmitter<File>();
	@Output() fileRename = new EventEmitter<{ file: File; event: Event }>();
	@Output() fileDelete = new EventEmitter<{ file: File; event: Event }>();
	@Output() fileSelect = new EventEmitter<File>();

	onFileAction(file: File): void {
		if (this.selectionMode) {
			this.fileSelect.emit(file);
		} else {
			this.fileClick.emit(file);
		}
	}
}
