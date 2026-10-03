import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrivacyPage } from './privacy';

describe('PrivacyPage', () => {
	let fixture: ComponentFixture<PrivacyPage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [PrivacyPage] }).compileComponents();
		fixture = TestBed.createComponent(PrivacyPage);
		fixture.detectChanges();
	});

	it('names the controller and a contact address', () => {
		const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
		expect(text).toContain('Ramphy Alexander Aquino Nova');
		expect(text).toContain('ramphy_an@outlook.com');
	});

	it('is marked as a draft until legally reviewed', () => {
		const notice = (fixture.nativeElement as HTMLElement).querySelector('.draft-notice');
		expect(notice?.textContent).toContain('pending legal review');
	});
});
