export type Visibility = 'PRIVATE' | 'PUBLIC' | 'SHARED';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export type ActiveModal = 'none' | 'create-folder' | 'rename' | 'delete' | 'bulk-delete' | 'share';

export interface File {
	id: string;
	name: string;
	description: string | null;
	fsPath: string;
	isDirectory: boolean;
	visibility: Visibility;
	parentId: string | null;
	ownerId: string;
	ownerDisplayName: string;
	sharedWithIds: string[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateFileRequest {
	name: string;
	description?: string;
	ownerId: string;
	parentId?: string | null;
	isDirectory: boolean;
	visibility?: Visibility;
	sharedWithIds?: string[];
}

export interface UpdateFileRequest {
	name?: string;
	description?: string;
	parentId?: string;
	visibility?: Visibility;
	sharedWithIds?: string[];
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

export interface DashboardMetrics {
	uploadedFiles: number;
	usedStorageBytes: number;
	sharedFiles: number;
}

export interface RecentFileItem {
	id: string;
	name: string;
	visibility: Visibility;
	sizeBytes: number;
	updatedAt: string;
}

export interface DashboardResponse {
	metrics: DashboardMetrics;
	recentFiles: RecentFileItem[];
}
