import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'fileSize',
})
export class FileSizePipe implements PipeTransform {
	transform(bytes: number | null): unknown {
		if (bytes === null || bytes === undefined) return '\u2014';
		if (bytes === 0) return '0 B';

		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
	}
}
