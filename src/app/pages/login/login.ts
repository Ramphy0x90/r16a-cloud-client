import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
	selector: 'login-page',
	templateUrl: './login.html',
	styleUrl: './login.css',
})
export class LoginPage {
	private readonly auth = inject(AuthService);

	login(): void {
		this.auth.login();
	}
}
