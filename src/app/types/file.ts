export type Visibility = 'PRIVATE' | 'PUBLIC' | 'SHARED';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface File {
	id: number;
	name: string;
	description: string | null;
	fsPath: string;
	isDirectory: boolean;
	visibility: Visibility;
	parentId: number | null;
	ownerId: number;
	sharedWithIds: number[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateFileRequest {
	name: string;
	description?: string;
	ownerId: number;
	parentId?: number | null;
	isDirectory: boolean;
	visibility?: Visibility;
	sharedWithIds?: number[];
}

export interface UpdateFileRequest {
	name?: string;
	description?: string;
	parentId?: number;
	visibility?: Visibility;
	sharedWithIds?: number[];
}

export interface PageResponse<T> {
	content: T[];
	totalElements: number;
	totalPages: number;
	size: number;
	number: number;
	first: boolean;
	last: boolean;
}
