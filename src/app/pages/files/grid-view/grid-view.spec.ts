import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridView } from './grid-view';

describe('GridView', () => {
  let component: GridView;
  let fixture: ComponentFixture<GridView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GridView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
