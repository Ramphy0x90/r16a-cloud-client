import { Injectable, inject } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';
import { FileService } from './file.service';
import { File, PageResponse, SortDirection, SortField } from '../types/file';

interface FileListCacheEntry {
	expiresAt: number;
	page$: Observable<PageResponse<File>>;
}

@Injectable({ providedIn: 'root' })
export class FilesCacheService {
	private readonly fileService = inject(FileService);

	private readonly ttlMs = 60_000;
	private readonly entriesByKey = new Map<string, FileListCacheEntry>();
	private readonly keysByFolder = new Map<string, Set<string>>();

	getFilesPageCached(
		ownerId: string,
		parentId: string | null,
		sortField: SortField = 'name',
		sortDirection: SortDirection = 'asc',
		page = 0,
		size = 50,
	): Observable<PageResponse<File>> {
		const cacheKey = this.buildCacheKey(ownerId, parentId, sortField, sortDirection, page, size);
		const now = Date.now();
		const existing = this.entriesByKey.get(cacheKey);
		if (existing && existing.expiresAt > now) {
			return existing.page$;
		}

		const page$ = this.fileService
			.getFiles(ownerId, parentId, sortField, sortDirection, page, size)
			.pipe(shareReplay({ bufferSize: 1, refCount: false }));

		this.entriesByKey.set(cacheKey, {
			expiresAt: now + this.ttlMs,
			page$,
		});
		this.trackKeyByFolder(this.buildFolderKey(ownerId, parentId), cacheKey);
		this.pruneExpiredEntries(now);

		return page$;
	}

	getFilesCached(
		ownerId: string,
		parentId: string | null,
		sortField: SortField = 'name',
		sortDirection: SortDirection = 'asc',
		page = 0,
		size = 50,
	): Observable<File[]> {
		return this.getFilesPageCached(
			ownerId,
			parentId,
			sortField,
			sortDirection,
			page,
			size,
		).pipe(map((p) => p.content));
	}

	invalidateFolder(ownerId: string, parentId: string | null): void {
		const folderKey = this.buildFolderKey(ownerId, parentId);
		const keysForFolder = this.keysByFolder.get(folderKey);
		if (!keysForFolder) {
			return;
		}

		for (const cacheKey of keysForFolder) {
			this.entriesByKey.delete(cacheKey);
		}
		this.keysByFolder.delete(folderKey);
	}

	invalidateAll(): void {
		this.entriesByKey.clear();
		this.keysByFolder.clear();
	}

	private pruneExpiredEntries(referenceTs: number): void {
		for (const [cacheKey, entry] of this.entriesByKey.entries()) {
			if (entry.expiresAt > referenceTs) continue;
			this.entriesByKey.delete(cacheKey);
			this.removeKeyFromFolders(cacheKey);
		}
	}

	private buildCacheKey(
		ownerId: string,
		parentId: string | null,
		sortField: SortField,
		sortDirection: SortDirection,
		page: number,
		size: number,
	): string {
		return [
			ownerId,
			parentId ?? 'root',
			sortField,
			sortDirection,
			page.toString(),
			size.toString(),
		].join('::');
	}

	private buildFolderKey(ownerId: string, parentId: string | null): string {
		return `${ownerId}::${parentId ?? 'root'}`;
	}

	private trackKeyByFolder(folderKey: string, cacheKey: string): void {
		const keys = this.keysByFolder.get(folderKey) ?? new Set<string>();
		keys.add(cacheKey);
		this.keysByFolder.set(folderKey, keys);
	}

	private removeKeyFromFolders(cacheKey: string): void {
		for (const [folderKey, keys] of this.keysByFolder.entries()) {
			if (!keys.delete(cacheKey)) continue;
			if (keys.size === 0) {
				this.keysByFolder.delete(folderKey);
			}
		}
	}
}
