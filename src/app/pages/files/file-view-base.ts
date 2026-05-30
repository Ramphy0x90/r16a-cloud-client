import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Observable, of } from 'rxjs';
import { File } from '../../types/file';
import { isImageFile, isVideoFile } from '../../utils/file-utils';

@Component({ template: '' })
export abstract class FileViewBase {
	@Input() files$: Observable<File[]> = of([]);
	@Input() selectedFile: File | null = null;
	@Input() selectionMode = false;
	@Input() selectedFileIds: Set<string> = new Set();
	@Input() imagePreviewUrls: Map<string, string> = new Map();
	@Input() showSharedFrom = false;

	@Output() fileClick = new EventEmitter<File>();
	@Output() fileRename = new EventEmitter<{ file: File; event: Event }>();
	@Output() fileDelete = new EventEmitter<{ file: File; event: Event }>();
	@Output() fileSelect = new EventEmitter<File>();
	@Output() imageVisible = new EventEmitter<File>();

	onFileAction(file: File): void {
		if (this.selectionMode) {
			this.fileSelect.emit(file);
		} else {
			this.fileClick.emit(file);
		}
	}

	isImageFile(file: File): boolean {
		return isImageFile(file);
	}

	isVideoFile(file: File): boolean {
		return isVideoFile(file);
	}

	getImagePreviewUrl(file: File): string | null {
		return this.imagePreviewUrls.get(file.id) ?? null;
	}

	onImageVisible(file: File): void {
		this.imageVisible.emit(file);
	}
}
