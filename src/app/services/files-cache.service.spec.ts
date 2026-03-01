import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FileService } from './file.service';
import { FilesCacheService } from './files-cache.service';
import { File, PageResponse } from '../types/file';

describe('FilesCacheService', () => {
	let service: FilesCacheService;

	const baseFile: File = {
		id: 'f-1',
		name: 'doc.txt',
		description: null,
		fsPath: '/doc.txt',
		isDirectory: false,
		visibility: 'PRIVATE',
		parentId: null,
		ownerId: 'owner-1',
		sharedWithIds: [],
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	const filesResponse: PageResponse<File> = {
		content: [baseFile],
		totalElements: 1,
		totalPages: 1,
		size: 50,
		number: 0,
		first: true,
		last: true,
	};

	const fileServiceMock = {
		getFiles: vi.fn(() => of(filesResponse)),
	};

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				FilesCacheService,
				{
					provide: FileService,
					useValue: fileServiceMock,
				},
			],
		});

		service = TestBed.inject(FilesCacheService);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('returns cached result for repeated query key', () => {
		service.getFilesCached('owner-1', null).subscribe();
		service.getFilesCached('owner-1', null).subscribe();

		expect(fileServiceMock.getFiles).toHaveBeenCalledTimes(1);
	});

	it('invalidates one folder without flushing others', () => {
		service.getFilesCached('owner-1', null).subscribe();
		service.getFilesCached('owner-1', 'folder-1').subscribe();
		expect(fileServiceMock.getFiles).toHaveBeenCalledTimes(2);

		service.invalidateFolder('owner-1', null);
		service.getFilesCached('owner-1', null).subscribe();
		service.getFilesCached('owner-1', 'folder-1').subscribe();

		expect(fileServiceMock.getFiles).toHaveBeenCalledTimes(3);
	});
});
