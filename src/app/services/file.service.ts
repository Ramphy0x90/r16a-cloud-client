import { Injectable, inject } from '@angular/core';
import {
	HttpClient,
	HttpEventType,
	HttpParams,
	HttpRequest,
	HttpResponse,
} from '@angular/common/http';
import { Observable, concatMap, filter, from, last, map, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
	CreateFileRequest,
	CursorPageResponse,
	DashboardResponse,
	File,
	PageResponse,
	SortDirection,
	SortField,
	UpdateFileRequest,
} from '../types/file';

/** Files larger than this use chunked upload (init / part / complete). */
export const CHUNK_UPLOAD_THRESHOLD_BYTES = 100 * 1024 * 1024;

export interface ChunkUploadInitResponse {
	uploadId: string;
	partSizeBytes: number;
}

@Injectable({ providedIn: 'root' })
export class FileService {
	private readonly http = inject(HttpClient);
	private readonly apiUrl = `${environment.apiUrl}/fs`;

	getFiles(
		ownerId: string,
		parentId: string | null,
		sortField: SortField = 'name',
		sortDirection: SortDirection = 'asc',
		cursor: string | null = null,
		limit = 50,
	): Observable<CursorPageResponse<File>> {
		let params = new HttpParams()
			.set('ownerId', ownerId)
			.set('sort', sortField)
			.set('dir', sortDirection)
			.set('limit', limit.toString());

		if (parentId !== null) params = params.set('parentId', parentId);
		if (cursor !== null) params = params.set('cursor', cursor);

		return this.http.get<CursorPageResponse<File>>(this.apiUrl, { params });
	}

	getFilesSharedWithMe(
		sortField: SortField = 'name',
		sortDirection: SortDirection = 'asc',
		page = 0,
		size = 50,
	): Observable<PageResponse<File>> {
		const params = new HttpParams()
			.set('page', page.toString())
			.set('size', size.toString())
			.append('sort', 'isDirectory,desc')
			.append('sort', `${sortField},${sortDirection}`);

		return this.http.get<PageResponse<File>>(`${this.apiUrl}/shared-with-me`, { params });
	}

	getFile(id: string): Observable<File> {
		return this.http.get<File>(`${this.apiUrl}/${id}`);
	}

	getDashboard(ownerId: string): Observable<DashboardResponse> {
		const params = new HttpParams().set('ownerId', ownerId.toString());
		return this.http.get<DashboardResponse>(`${this.apiUrl}/dashboard`, { params });
	}

	createFile(request: CreateFileRequest): Observable<File> {
		return this.http.post<File>(this.apiUrl, request);
	}

	/**
	 * Uploads a single file. Uses multipart POST for smaller files and chunked upload for large files.
	 */
	uploadFile(
		ownerId: string,
		parentId: string | null,
		file: globalThis.File,
		onProgress?: (loaded: number, total: number) => void,
	): Observable<File> {
		if (file.size > CHUNK_UPLOAD_THRESHOLD_BYTES) {
			return this.uploadFileChunked(ownerId, parentId, file, onProgress);
		}
		return this.uploadFileMultipart(ownerId, parentId, file, onProgress);
	}

	private uploadFileMultipart(
		ownerId: string,
		parentId: string | null,
		file: globalThis.File,
		onProgress?: (loaded: number, total: number) => void,
	): Observable<File> {
		const formData = new FormData();
		formData.append('ownerId', ownerId.toString());
		if (parentId !== null) {
			formData.append('parentId', parentId.toString());
		}
		formData.append('file', file);

		const req = new HttpRequest('POST', `${this.apiUrl}/upload`, formData, {
			reportProgress: true,
		});

		return this.http.request<File>(req).pipe(
			tap((event) => {
				if (event.type === HttpEventType.UploadProgress && event.total != null) {
					onProgress?.(event.loaded, event.total);
				}
			}),
			filter((e): e is HttpResponse<File> => e.type === HttpEventType.Response),
			map((e) => e.body!),
		);
	}

	private uploadFileChunked(
		ownerId: string,
		parentId: string | null,
		file: globalThis.File,
		onProgress?: (loaded: number, total: number) => void,
	): Observable<File> {
		const body = {
			ownerId,
			parentId,
			fileName: file.name,
			totalSize: file.size,
			partSizeBytes: null as number | null,
			description: null as string | null,
			visibility: null as string | null,
			sharedWithIds: null as string[] | null,
		};

		return this.http.post<ChunkUploadInitResponse>(`${this.apiUrl}/upload/init`, body).pipe(
			switchMap((init) => {
				if (file.size === 0) {
					return this.completeChunkedUpload(init.uploadId);
				}
				return this.uploadAllParts(init.uploadId, init.partSizeBytes, file, onProgress).pipe(
					switchMap(() => this.completeChunkedUpload(init.uploadId)),
				);
			}),
		);
	}

	private uploadAllParts(
		uploadId: string,
		partSizeBytes: number,
		file: globalThis.File,
		onProgress?: (loaded: number, total: number) => void,
	): Observable<void> {
		const slices: { start: number; end: number }[] = [];
		for (let start = 0; start < file.size; start += partSizeBytes) {
			const end = Math.min(start + partSizeBytes, file.size);
			slices.push({ start, end });
		}

		return from(slices).pipe(
			concatMap(({ start, end }) =>
				this.putChunk(uploadId, file.slice(start, end)).pipe(
					tap(() => onProgress?.(end, file.size)),
				),
			),
			last(),
			map(() => void 0),
		);
	}

	private putChunk(uploadId: string, blob: Blob): Observable<void> {
		return this.http
			.put(`${this.apiUrl}/upload/${uploadId}/part`, blob, {
				headers: { 'Content-Type': 'application/octet-stream' },
				observe: 'response',
				responseType: 'blob',
			})
			.pipe(map(() => void 0));
	}

	private completeChunkedUpload(uploadId: string): Observable<File> {
		return this.http.post<File>(`${this.apiUrl}/upload/${uploadId}/complete`, {});
	}

	updateFile(id: string, request: UpdateFileRequest): Observable<File> {
		return this.http.put<File>(`${this.apiUrl}/${id}`, request);
	}

	updateFileSharing(id: string, sharedWithIds: string[]): Observable<File> {
		return this.http.patch<File>(`${this.apiUrl}/${id}/sharing`, { sharedWithIds });
	}

	deleteFile(id: string): Observable<void> {
		return this.http.delete<void>(`${this.apiUrl}/${id}`);
	}

	downloadFile(id: string): Observable<HttpResponse<Blob>> {
		return this.http.get(`${this.apiUrl}/${id}/download`, {
			observe: 'response',
			responseType: 'blob',
		});
	}

	downloadThumbnail(
		id: string,
		size: 'small' | 'medium' = 'small',
	): Observable<HttpResponse<Blob>> {
		const params = new HttpParams().set('size', size);
		return this.http.get(`${this.apiUrl}/${id}/thumbnail`, {
			params,
			observe: 'response',
			responseType: 'blob',
		});
	}

	downloadFiles(ids: string[]): Observable<HttpResponse<Blob>> {
		return this.http.post(
			`${this.apiUrl}/download`,
			{ ids },
			{ observe: 'response', responseType: 'blob' },
		);
	}
}
