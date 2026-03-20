import { File } from '../types/file';

export function isImageFile(file: File): boolean {
	if (file.isDirectory) return false;
	return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
}
