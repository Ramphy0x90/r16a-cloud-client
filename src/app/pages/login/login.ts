import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { IdentityLogo } from '../../components/identity-logo/identity-logo';

@Component({
	selector: 'login-page',
	templateUrl: './login.html',
	styleUrl: './login.css',
	imports: [IdentityLogo],
})
export class LoginPage {
	private readonly auth = inject(AuthService);

	login(): void {
		this.auth.login();
	}
}
