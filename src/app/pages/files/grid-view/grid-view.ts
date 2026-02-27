import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { File } from '../../../types/file';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';

@Component({
	selector: 'grid-view',
	imports: [CommonModule, IconFromExtensionPipe],
	templateUrl: './grid-view.html',
	styleUrl: './grid-view.css',
})
export class GridView {
	@Input() files$: Observable<File[]> = of([]);
	@Input() selectedFile: File | null = null;
	@Input() selectionMode = false;
	@Input() selectedFileIds: Set<string> = new Set();
	@Input() imagePreviewUrls: Map<string, string> = new Map();

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

	isImageFile(file: File): boolean {
		if (file.isDirectory) return false;
		return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
	}

	getImagePreviewUrl(file: File): string | null {
		return this.imagePreviewUrls.get(file.id) ?? null;
	}
}
