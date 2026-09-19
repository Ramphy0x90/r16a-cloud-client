// TEMP: pointed at LAN IP for phone testing over local HTTPS. Revert to
// localhost before committing. apiUrl is relative so the browser only ever
// talks to the HTTPS dev server; proxy.conf.json forwards /api to the
// backend over plain HTTP internally (avoids mixed-content blocking).
const LAN_HOST = '192.168.1.107';

export const environment = {
	production: false,
	apiUrl: '/api',
	oidc: {
		authority: 'https://auth.r16a.cloud/application/o/r16a-cloud-local',
		clientId: '2Jati6hlDzX22iHuRMdDdliwLYmU8sLrUWjVbIO4',
		redirectUrl: `https://${LAN_HOST}:4200/callback`,
		postLogoutRedirectUri: `https://${LAN_HOST}:4200/`,
		scopes: 'openid profile email offline_access',
	},
};
