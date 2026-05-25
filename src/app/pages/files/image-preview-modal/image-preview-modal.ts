import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { blurhashToDataUrl } from '../../../utils/blurhash';

export interface ImagePreviewModalState {
	show: boolean;
	fileName: string | null;
	fileId: string | null;
	url: string | null;
	thumbnailUrl: string | null;
	blurHash: string | null;
	loading: boolean;
}

@Component({
	selector: 'image-preview-modal',
	imports: [CommonModule],
	templateUrl: './image-preview-modal.html',
	styleUrl: './image-preview-modal.css',
})
export class ImagePreviewModal {
	@Input() state: ImagePreviewModalState | null = null;
	@Output() close = new EventEmitter<void>();

	readonly blurhashToDataUrl = blurhashToDataUrl;

	onClose(): void {
		this.close.emit();
	}
}
