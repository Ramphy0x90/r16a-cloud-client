import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdentityLogo } from './identity-logo';

describe('IdentityLogo', () => {
  let component: IdentityLogo;
  let fixture: ComponentFixture<IdentityLogo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentityLogo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdentityLogo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
