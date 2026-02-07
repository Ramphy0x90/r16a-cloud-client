import { Component } from '@angular/core';
import { QuickSettings } from '../quick-settings/quick-settings';
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-header',
	imports: [CommonModule, QuickSettings],
	templateUrl: './header.html',
	styleUrl: './header.css',
})
export class Header {}
