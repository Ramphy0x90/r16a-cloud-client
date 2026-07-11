import { Component, input, output } from '@angular/core';
import { NavBarItem } from '../../types/nav-bar-item';
import { NAV_BAR_ROUTES } from '../../app.routes';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IdentityLogo } from '../identity-logo/identity-logo';

@Component({
	selector: 'nav-bar',
	imports: [CommonModule, RouterLink, RouterLinkActive, IdentityLogo],
	templateUrl: './nav-bar.html',
	styleUrl: './nav-bar.css',
})
export class NavBar {
	readonly isOpen = input<boolean>(false);
	readonly close = output<void>();

	navOptions: readonly NavBarItem[] = NAV_BAR_ROUTES;
}
