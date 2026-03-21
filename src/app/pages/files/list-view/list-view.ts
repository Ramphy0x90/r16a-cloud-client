import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';
import { InViewportDirective } from '../../../directives/in-viewport.directive';
import { FileViewBase } from '../file-view-base';

@Component({
	selector: 'list-view',
	imports: [CommonModule, IconFromExtensionPipe, InViewportDirective],
	templateUrl: './list-view.html',
	styleUrl: './list-view.css',
})
export class ListView extends FileViewBase {}
