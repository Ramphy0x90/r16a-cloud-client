import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'iconFromExtension',
})
export class IconFromExtensionPipe implements PipeTransform {
	private readonly img_ext = new Set(['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG', 'AVIF', 'TIFF']);
	private readonly video_ext = new Set(['MP4', 'MOV', 'AVI', 'WMV', 'MKV', 'WEBM']);
	private readonly audio_ext = new Set(['MP3', 'AAC', 'OGG', 'WMA', 'M4A', 'RA', 'OPUS']);

	transform(fileName: string): string {
		const lastDot = fileName.lastIndexOf('.');
		const extension = lastDot === -1 ? '' : fileName.slice(lastDot + 1);

		if (this.img_ext.has(extension.toUpperCase())) return 'bi-file-image';
		if (this.video_ext.has(extension.toUpperCase())) return 'bi-file-play';
		if (this.audio_ext.has(extension.toUpperCase())) return 'bi-file-music';

		return 'bi-file-earmark';
	}
}
