import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileOptions } from './file-options';

describe('FileOptions', () => {
  let component: FileOptions;
  let fixture: ComponentFixture<FileOptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileOptions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileOptions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
