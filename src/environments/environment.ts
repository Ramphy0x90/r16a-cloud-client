export const environment = {
	production: false,
	apiUrl: 'http://localhost:8080/api',
	oidc: {
		authority: 'https://auth.r16a.cloud/application/o/r16a-cloud-local',
		clientId: '2Jati6hlDzX22iHuRMdDdliwLYmU8sLrUWjVbIO4',
		redirectUrl: 'http://localhost:4200/callback',
		postLogoutRedirectUri: 'http://localhost:4200/login',
		scopes: 'openid profile email',
	},
};
