import { inject, Injectable, OnDestroy } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, take, timeout } from 'rxjs';
import { File } from '../types/file';
import { FileService } from './file.service';

interface CachedThumbnail {
	url: string;
	expiresAt: number;
	lastAccessedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ImagePreviewService implements OnDestroy {
	private readonly fileService = inject(FileService);

	private readonly thumbnailCache = new Map<string, CachedThumbnail>();
	private readonly thumbnailInFlight = new Map<string, Observable<[string, string] | null>>();
	private readonly fullPreviewCache = new Map<string, string>();

	private readonly ttlMs = 5 * 60_000;
	private readonly maxCacheSize = 400;

	getThumbnailUrl(fileId: string): string | null {
		const cached = this.thumbnailCache.get(fileId);
		if (!cached) return null;
		if (cached.expiresAt <= Date.now()) {
			this.evictThumbnail(fileId);
			return null;
		}
		cached.lastAccessedAt = Date.now();
		return cached.url;
	}

	ensureThumbnail$(file: File): Observable<[string, string] | null> {
		const existing = this.getThumbnailUrl(file.id);
		if (existing) return of([file.id, existing]);

		const inflight = this.thumbnailInFlight.get(file.id);
		if (inflight) return inflight;

		const request$ = this.fileService.downloadThumbnail(file.id, 'small').pipe(
			take(1),
			map((response) => {
				if (!response.body) return null;
				const url = URL.createObjectURL(response.body);
				this.storeThumbnail(file.id, url);
				return [file.id, url] as [string, string];
			}),
			catchError((err) => {
				console.error('Failed to load image thumbnail:', err);
				return of(null);
			}),
			finalize(() => this.thumbnailInFlight.delete(file.id)),
			shareReplay({ bufferSize: 1, refCount: true }),
		);

		this.thumbnailInFlight.set(file.id, request$);

		return request$;
	}

	ensureFullPreview$(file: File): Observable<[string, string] | null> {
		const existing = this.fullPreviewCache.get(file.id);
		if (existing) return of([file.id, existing]);

		// HEIC/HEIF cannot be rendered by browsers natively (except Safari).
		// Request a server-side converted JPEG at large size instead of the raw file.
		const isHeic = /\.(heic|heif)$/i.test(file.name);
		const source$ = isHeic
			? this.fileService.downloadThumbnail(file.id, 'large').pipe(timeout(30_000))
			: this.fileService.downloadFile(file.id).pipe(timeout(15_000));

		return source$.pipe(
			take(1),
			map((response) => {
				if (!response.body) return null;
				const url = URL.createObjectURL(response.body);
				this.fullPreviewCache.set(file.id, url);
				return [file.id, url] as [string, string];
			}),
			catchError((err) => {
				console.error('Failed to load full image preview:', err);
				return of(null);
			}),
		);
	}

	buildThumbnailMapForFiles(files: File[]): Map<string, string> {
		this.cleanupExpired();
		const result = new Map<string, string>();
		for (const file of files) {
			const url = this.getThumbnailUrl(file.id);
			if (url) result.set(file.id, url);
		}
		return result;
	}

	revokeAll(): void {
		for (const preview of this.thumbnailCache.values()) URL.revokeObjectURL(preview.url);
		this.thumbnailCache.clear();
		this.thumbnailInFlight.clear();

		for (const url of this.fullPreviewCache.values()) URL.revokeObjectURL(url);
		this.fullPreviewCache.clear();
	}

	ngOnDestroy(): void {
		this.revokeAll();
	}

	private storeThumbnail(fileId: string, url: string): void {
		this.thumbnailCache.set(fileId, {
			url,
			expiresAt: Date.now() + this.ttlMs,
			lastAccessedAt: Date.now(),
		});
		this.evictExcess();
	}

	private evictExcess(): void {
		if (this.thumbnailCache.size <= this.maxCacheSize) return;
		const ordered = Array.from(this.thumbnailCache.entries()).sort(
			(a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt,
		);
		for (const [fileId] of ordered) {
			if (this.thumbnailCache.size <= this.maxCacheSize) break;
			this.evictThumbnail(fileId);
		}
	}

	private evictThumbnail(fileId: string): void {
		const preview = this.thumbnailCache.get(fileId);
		if (!preview) return;
		URL.revokeObjectURL(preview.url);
		this.thumbnailCache.delete(fileId);
	}

	private cleanupExpired(): void {
		const now = Date.now();
		for (const [fileId, preview] of this.thumbnailCache) {
			if (preview.expiresAt <= now) this.evictThumbnail(fileId);
		}
	}
}
