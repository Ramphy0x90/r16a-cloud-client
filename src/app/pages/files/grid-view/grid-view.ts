import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';
import { InViewportDirective } from '../../../directives/in-viewport.directive';
import { FileViewBase } from '../file-view-base';

@Component({
	selector: 'grid-view',
	imports: [CommonModule, IconFromExtensionPipe, InViewportDirective],
	templateUrl: './grid-view.html',
	styleUrl: './grid-view.css',
})
export class GridView extends FileViewBase {}
