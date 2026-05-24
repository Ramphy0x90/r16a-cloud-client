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
	blurHash: string | null;
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
	last: boolean;
	number: number;
}

export interface CursorPageResponse<T> {
	content: T[];
	nextCursor: string | null;
	hasMore: boolean;
}

export interface FileEventDto {
	fileId: string;
	parentId: string | null;
	fileName: string;
	eventType: 'CREATED' | 'UPDATED' | 'DELETED';
	occurredAt: number;
}

export interface FileEventsResponse {
	events: FileEventDto[];
	nextCursor: number;
	hasMore: boolean;
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

export interface PhotoYearSummary {
	year: number;
	count: number;
}
