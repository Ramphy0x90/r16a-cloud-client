import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';
import { InViewportDirective } from '../../../directives/in-viewport.directive';
import { FileViewBase } from '../file-view-base';
import { File } from '../../../types/file';

@Component({
	selector: 'list-view',
	imports: [CommonModule, ScrollingModule, IconFromExtensionPipe, InViewportDirective],
	templateUrl: './list-view.html',
	styleUrl: './list-view.css',
})
export class ListView extends FileViewBase {
	trackById(_: number, file: File): string {
		return file.id;
	}
}
