import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickSettings } from './quick-settings';

describe('QuickSettings', () => {
  let component: QuickSettings;
  let fixture: ComponentFixture<QuickSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickSettings]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuickSettings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
