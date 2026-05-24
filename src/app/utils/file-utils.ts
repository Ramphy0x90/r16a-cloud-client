import { File } from '../types/file';
import { HttpResponse } from '@angular/common/http';

export function isImageFile(file: File): boolean {
	if (file.isDirectory) return false;
	return /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(file.name);
}

export function isVideoFile(file: File): boolean {
	if (file.isDirectory) return false;
	return /\.(avi|m4v|mkv|mov|mp4|webm)$/i.test(file.name);
}

export function isMediaFile(file: File): boolean {
	return isImageFile(file) || isVideoFile(file);
}

export function extractDownloadFilename(response: HttpResponse<Blob>): string | null {
	const contentDisposition = response.headers.get('content-disposition');
	if (!contentDisposition) return null;

	const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (encodedMatch?.[1]) {
		return decodeURIComponent(encodedMatch[1]);
	}

	const regularMatch = contentDisposition.match(/filename="([^"]+)"/i);
	return regularMatch?.[1] ?? null;
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}
