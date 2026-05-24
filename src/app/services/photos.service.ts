import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CursorPageResponse, File, PhotoYearSummary } from '../types/file';

@Injectable({ providedIn: 'root' })
export class PhotosService {
	private readonly http = inject(HttpClient);
	private readonly apiUrl = `${environment.apiUrl}/photos`;

	getPhotoYears(ownerId: string): Observable<PhotoYearSummary[]> {
		return this.http.get<PhotoYearSummary[]>(`${this.apiUrl}/years`, {
			params: new HttpParams().set('ownerId', ownerId),
		});
	}

	getPhotos(
		ownerId: string,
		year: number,
		cursor: string | null = null,
		limit = 60,
	): Observable<CursorPageResponse<File>> {
		let params = new HttpParams()
			.set('ownerId', ownerId)
			.set('year', year.toString())
			.set('limit', limit.toString());
		if (cursor) params = params.set('cursor', cursor);
		return this.http.get<CursorPageResponse<File>>(this.apiUrl, { params });
	}
}
