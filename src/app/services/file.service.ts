import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateFileRequest, FileResponse, PageResponse, UpdateFileRequest } from '../types/file';

@Injectable({ providedIn: 'root' })
export class FileService {
	private readonly http = inject(HttpClient);
	private readonly apiUrl = `${environment.apiUrl}/fs`;

	getFiles(
		ownerId: number,
		parentId: number | null,
		page = 0,
		size = 50,
	): Observable<PageResponse<FileResponse>> {
		let params = new HttpParams()
			.set('ownerId', ownerId.toString())
			.set('page', page.toString())
			.set('size', size.toString())
			.append('sort', 'isDirectory,desc')
			.append('sort', 'name,asc');

		if (parentId !== null) {
			params = params.set('parentId', parentId.toString());
		}

		return this.http.get<PageResponse<FileResponse>>(this.apiUrl, { params });
	}

	getFile(id: number): Observable<FileResponse> {
		return this.http.get<FileResponse>(`${this.apiUrl}/${id}`);
	}

	createFile(request: CreateFileRequest): Observable<FileResponse> {
		return this.http.post<FileResponse>(this.apiUrl, request);
	}

	updateFile(id: number, request: UpdateFileRequest): Observable<FileResponse> {
		return this.http.put<FileResponse>(`${this.apiUrl}/${id}`, request);
	}

	deleteFile(id: number): Observable<void> {
		return this.http.delete<void>(`${this.apiUrl}/${id}`);
	}
}
