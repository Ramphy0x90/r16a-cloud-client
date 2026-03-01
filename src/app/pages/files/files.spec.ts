import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { FilesPage } from './files';
import { FileService } from '../../services/file.service';
import { UserService } from '../../services/user.service';
import { File, PageResponse } from '../../types/file';

describe('FilesPage', () => {
	let component: FilesPage;
	let fixture: ComponentFixture<FilesPage>;
	let thumbnailResponse$: Subject<HttpResponse<Blob>>;

	const imageFile: File = {
		id: 'img-1',
		name: 'photo.png',
		description: null,
		fsPath: '/photo.png',
		isDirectory: false,
		visibility: 'PRIVATE',
		parentId: null,
		ownerId: 'owner-1',
		sharedWithIds: [],
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	const filesResponse: PageResponse<File> = {
		content: [imageFile],
		totalElements: 1,
		totalPages: 1,
		size: 50,
		number: 0,
		first: true,
		last: true,
	};

	const fileServiceMock = {
		getFiles: vi.fn(() => of(filesResponse)),
		getFile: vi.fn(),
		createFile: vi.fn(() => of(imageFile)),
		uploadFile: vi.fn(() => of(imageFile)),
		updateFile: vi.fn(() => of(imageFile)),
		deleteFile: vi.fn(() => of(void 0)),
		downloadFile: vi.fn(() => of(new HttpResponse<Blob>({ body: new Blob(['full']) }))),
		downloadFiles: vi.fn(() => of(new HttpResponse<Blob>({ body: new Blob(['zip']) }))),
		downloadThumbnail: vi.fn(() => thumbnailResponse$.asObservable()),
	};

	const userServiceMock = {
		currentUser$: of({ id: 'owner-1' }),
	};

	beforeEach(async () => {
		thumbnailResponse$ = new Subject<HttpResponse<Blob>>();

		await TestBed.configureTestingModule({
			imports: [FilesPage],
			providers: [
				{ provide: FileService, useValue: fileServiceMock },
				{ provide: UserService, useValue: userServiceMock },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(FilesPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	afterEach(() => {
		thumbnailResponse$.complete();
		fixture.destroy();
		vi.clearAllMocks();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('deduplicates in-flight thumbnail requests for same file', () => {
		component.onImageVisible(imageFile);
		component.onImageVisible(imageFile);

		expect(fileServiceMock.downloadThumbnail).toHaveBeenCalledTimes(1);

		thumbnailResponse$.next(new HttpResponse<Blob>({ body: new Blob(['thumb']) }));
		thumbnailResponse$.complete();
	});
});
