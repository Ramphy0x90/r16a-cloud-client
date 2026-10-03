import { Component } from '@angular/core';

/**
 * Public privacy policy (no sign-in needed). Linked from the mobile app and
 * required as the "privacy policy URL" by the App Store and Google Play.
 * Keep it in sync with what the app and backend actually do.
 */
@Component({
	selector: 'privacy-page',
	templateUrl: './privacy.html',
	styleUrl: './privacy.css',
})
export class PrivacyPage {
	/**
	 * Shows the "draft pending legal review" notice. Set to false only after
	 * a lawyer has reviewed the text below.
	 */
	readonly isDraft = true;
	readonly lastUpdated = '3 October 2026';
}
