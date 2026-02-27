import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
	CreateFileRequest,
	File,
	PageResponse,
	SortDirection,
	SortField,
	UpdateFileRequest,
} from '../types/file';

@Injectable({ providedIn: 'root' })
export class FileService {
	private readonly http = inject(HttpClient);
	private readonly apiUrl = `${environment.apiUrl}/fs`;

	getFiles(
		ownerId: string,
		parentId: string | null,
		sortField: SortField = 'name',
		sortDirection: SortDirection = 'asc',
		page = 0,
		size = 50,
	): Observable<PageResponse<File>> {
		let params = new HttpParams()
			.set('ownerId', ownerId.toString())
			.set('page', page.toString())
			.set('size', size.toString())
			.append('sort', 'isDirectory,desc')
			.append('sort', `${sortField},${sortDirection}`);

		if (parentId !== null) {
			params = params.set('parentId', parentId.toString());
		}

		return this.http.get<PageResponse<File>>(this.apiUrl, { params });
	}

	getFile(id: string): Observable<File> {
		return this.http.get<File>(`${this.apiUrl}/${id}`);
	}

	createFile(request: CreateFileRequest): Observable<File> {
		return this.http.post<File>(this.apiUrl, request);
	}

	uploadFile(ownerId: string, parentId: string | null, file: globalThis.File): Observable<File> {
		const formData = new FormData();
		formData.append('ownerId', ownerId.toString());

		if (parentId !== null) {
			formData.append('parentId', parentId.toString());
		}

		formData.append('file', file);
		return this.http.post<File>(`${this.apiUrl}/upload`, formData);
	}

	updateFile(id: string, request: UpdateFileRequest): Observable<File> {
		return this.http.put<File>(`${this.apiUrl}/${id}`, request);
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

	downloadFiles(ids: string[]): Observable<HttpResponse<Blob>> {
		return this.http.post(`${this.apiUrl}/download`, { ids }, { observe: 'response', responseType: 'blob' });
	}
}
