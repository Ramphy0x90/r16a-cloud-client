import { Injectable } from '@angular/core';
import { CursorPageResponse, File } from '../types/file';

const DB_NAME = 'r16a-files';
const DB_VERSION = 1;
const STORE = 'listings';
const ENTRY_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface DbEntry {
	key: string;
	data: CursorPageResponse<File>;
	storedAt: number;
}

@Injectable({ providedIn: 'root' })
export class FileListingDbService {
	private dbPromise: Promise<IDBDatabase> | null = null;

	private openDb(): Promise<IDBDatabase> {
		if (this.dbPromise) return this.dbPromise;
		this.dbPromise = new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = (e) => {
				const db = (e.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE, { keyPath: 'key' });
				}
			};
			req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
			req.onerror = () => {
				this.dbPromise = null;
				reject(req.error);
			};
		});
		return this.dbPromise;
	}

	async get(key: string): Promise<CursorPageResponse<File> | null> {
		try {
			const db = await this.openDb();
			return new Promise((resolve) => {
				const tx = db.transaction(STORE, 'readonly');
				const req = tx.objectStore(STORE).get(key);
				req.onsuccess = () => {
					const entry = req.result as DbEntry | undefined;
					if (!entry || Date.now() - entry.storedAt > ENTRY_TTL_MS) {
						resolve(null);
					} else {
						resolve(entry.data);
					}
				};
				req.onerror = () => resolve(null);
			});
		} catch {
			return null;
		}
	}

	async set(key: string, data: CursorPageResponse<File>): Promise<void> {
		try {
			const db = await this.openDb();
			return new Promise((resolve) => {
				const entry: DbEntry = { key, data, storedAt: Date.now() };
				const tx = db.transaction(STORE, 'readwrite');
				tx.objectStore(STORE).put(entry);
				tx.oncomplete = () => resolve();
				tx.onerror = () => resolve();
			});
		} catch {
			// IndexedDB unavailable (private browsing etc.) — silently ignore
		}
	}

	async delete(key: string): Promise<void> {
		try {
			const db = await this.openDb();
			return new Promise((resolve) => {
				const tx = db.transaction(STORE, 'readwrite');
				tx.objectStore(STORE).delete(key);
				tx.oncomplete = () => resolve();
				tx.onerror = () => resolve();
			});
		} catch {}
	}

	async deleteByPrefix(prefix: string): Promise<void> {
		try {
			const db = await this.openDb();
			return new Promise((resolve) => {
				const tx = db.transaction(STORE, 'readwrite');
				const store = tx.objectStore(STORE);
				const req = store.openCursor();
				req.onsuccess = (e) => {
					const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
					if (cursor) {
						if ((cursor.key as string).startsWith(prefix)) cursor.delete();
						cursor.continue();
					}
				};
				tx.oncomplete = () => resolve();
				tx.onerror = () => resolve();
			});
		} catch {}
	}
}
