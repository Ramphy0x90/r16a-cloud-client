import { Component } from '@angular/core';
import { NavBarItem } from '../../types/nav-bar-item';
import { NAV_BAR_ROUTES } from '../../app.routes';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
	selector: 'nav-bar',
	imports: [CommonModule, RouterLink, RouterLinkActive],
	templateUrl: './nav-bar.html',
	styleUrl: './nav-bar.css',
})
export class NavBar {
	navOptions: readonly NavBarItem[] = NAV_BAR_ROUTES;
}
