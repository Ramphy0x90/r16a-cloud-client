import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedPage } from './shared';

describe('SharedPage', () => {
  let component: SharedPage;
  let fixture: ComponentFixture<SharedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
