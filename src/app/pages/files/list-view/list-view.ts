import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { File } from '../../../types/file';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';
import { InViewportDirective } from '../../../directives/in-viewport.directive';
import { FileService } from '../../../services/file.service';

@Component({
	selector: 'list-view',
	imports: [CommonModule, IconFromExtensionPipe, InViewportDirective],
	templateUrl: './list-view.html',
	styleUrl: './list-view.css',
})
export class ListView {
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

	private readonly fileService = inject(FileService);

	onFileAction(file: File): void {
		if (this.selectionMode) {
			this.fileSelect.emit(file);
		} else {
			this.fileClick.emit(file);
		}
	}

	isImageFile(file: File): boolean {
		return this.fileService.isImageFile(file);
	}

	getImagePreviewUrl(file: File): string | null {
		return this.imagePreviewUrls.get(file.id) ?? null;
	}

	onImageVisible(file: File): void {
		this.imageVisible.emit(file);
	}
}
