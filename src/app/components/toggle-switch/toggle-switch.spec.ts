import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToggleSwitch } from './toggle-switch';

describe('ToggleSwitch', () => {
  let component: ToggleSwitch;
  let fixture: ComponentFixture<ToggleSwitch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToggleSwitch]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToggleSwitch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
