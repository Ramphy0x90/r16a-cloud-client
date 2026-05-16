import { Injectable, inject } from '@angular/core';
import { Observable, from, of, shareReplay, switchMap, tap } from 'rxjs';
import { FileService } from './file.service';
import { FileListingDbService } from './file-listing-db.service';
import { CursorPageResponse, File, SortDirection, SortField } from '../types/file';

interface CacheEntry {
	expiresAt: number;
	page$: Observable<CursorPageResponse<File>>;
}

@Injectable({ providedIn: 'root' })
export class FilesCacheService {
	private readonly fileService = inject(FileService);
	private readonly db = inject(FileListingDbService);

	private readonly ttlMs = 60_000;
	private readonly entriesByKey = new Map<string, CacheEntry>();
	private readonly keysByFolder = new Map<string, Set<string>>();

	/** First page — no cursor. Serves IndexedDB data instantly on first load. */
	getFirstPageCached(
		ownerId: string,
		parentId: string | null,
		sortField: SortField = 'name',
		sortDirection: SortDirection = 'asc',
		limit = 50,
	): Observable<CursorPageResponse<File>> {
		const cacheKey = this.buildFirstPageKey(ownerId, parentId, sortField, sortDirection, limit);
		return this.getOrFetchWithDb(cacheKey, ownerId, parentId, () =>
			this.fileService.getFiles(ownerId, parentId, sortField, sortDirection, null, limit),
		);
	}

	/** Subsequent pages — identified by cursor. */
	getNextPageCached(
		ownerId: string,
		parentId: string | null,
		cursor: string,
		sortField: SortField,
		sortDirection: SortDirection,
		limit = 50,
	): Observable<CursorPageResponse<File>> {
		const cacheKey = `cursor::${cursor}`;
		return this.getOrFetch(cacheKey, ownerId, parentId, () =>
			this.fileService.getFiles(ownerId, parentId, sortField, sortDirection, cursor, limit),
		);
	}

	invalidateFolder(ownerId: string, parentId: string | null): void {
		const folderKey = this.buildFolderKey(ownerId, parentId);
		const keys = this.keysByFolder.get(folderKey);
		if (keys) {
			for (const key of keys) this.entriesByKey.delete(key);
			this.keysByFolder.delete(folderKey);
		}
		// Also evict from IndexedDB
		this.db.deleteByPrefix(this.buildFolderKey(ownerId, parentId));
	}

	invalidateAll(): void {
		this.entriesByKey.clear();
		this.keysByFolder.clear();
	}

	/**
	 * For first-page loads: check in-memory cache, then IndexedDB, then network.
	 * Network response is always persisted back to IndexedDB.
	 */
	private getOrFetchWithDb(
		cacheKey: string,
		ownerId: string,
		parentId: string | null,
		fetch: () => Observable<CursorPageResponse<File>>,
	): Observable<CursorPageResponse<File>> {
		const now = Date.now();
		const existing = this.entriesByKey.get(cacheKey);
		if (existing && existing.expiresAt > now) return existing.page$;

		const networkFetch$ = fetch().pipe(
			tap({
				next: (page) => this.db.set(cacheKey, page),
				error: () => this.evictKey(cacheKey),
			}),
			shareReplay({ bufferSize: 1, refCount: false }),
		);

		// Try IndexedDB first, fall back to network fetch
		const page$ = from(this.db.get(cacheKey)).pipe(
			switchMap((cached) => (cached ? of(cached) : networkFetch$)),
			shareReplay({ bufferSize: 1, refCount: false }),
		);

		this.entriesByKey.set(cacheKey, { expiresAt: now + this.ttlMs, page$ });
		this.trackKeyByFolder(this.buildFolderKey(ownerId, parentId), cacheKey);
		this.pruneExpiredEntries(now);
		return page$;
	}

	private getOrFetch(
		cacheKey: string,
		ownerId: string,
		parentId: string | null,
		fetch: () => Observable<CursorPageResponse<File>>,
	): Observable<CursorPageResponse<File>> {
		const now = Date.now();
		const existing = this.entriesByKey.get(cacheKey);
		if (existing && existing.expiresAt > now) return existing.page$;

		const page$ = fetch().pipe(
			tap({ error: () => this.evictKey(cacheKey) }),
			shareReplay({ bufferSize: 1, refCount: false }),
		);
		this.entriesByKey.set(cacheKey, { expiresAt: now + this.ttlMs, page$ });
		this.trackKeyByFolder(this.buildFolderKey(ownerId, parentId), cacheKey);
		this.pruneExpiredEntries(now);
		return page$;
	}

	private evictKey(cacheKey: string): void {
		this.entriesByKey.delete(cacheKey);
		for (const keys of this.keysByFolder.values()) keys.delete(cacheKey);
	}

	private buildFirstPageKey(
		ownerId: string,
		parentId: string | null,
		sortField: SortField,
		sortDirection: SortDirection,
		limit: number,
	): string {
		return [ownerId, parentId ?? 'root', sortField, sortDirection, limit].join('::');
	}

	private buildFolderKey(ownerId: string, parentId: string | null): string {
		return `${ownerId}::${parentId ?? 'root'}`;
	}

	private trackKeyByFolder(folderKey: string, cacheKey: string): void {
		const keys = this.keysByFolder.get(folderKey) ?? new Set<string>();
		keys.add(cacheKey);
		this.keysByFolder.set(folderKey, keys);
	}

	private pruneExpiredEntries(referenceTs: number): void {
		for (const [key, entry] of this.entriesByKey.entries()) {
			if (entry.expiresAt > referenceTs) continue;
			this.entriesByKey.delete(key);
			for (const keys of this.keysByFolder.values()) keys.delete(key);
		}
	}
}
