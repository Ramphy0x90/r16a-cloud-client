import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Subscription, interval } from 'rxjs';
import { switchMap, catchError, takeUntil } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { FileService } from './file.service';
import { FilesCacheService } from './files-cache.service';
import { FileEventDto } from '../types/file';

export interface FolderChangedEvent {
	ownerId: string;
	parentId: string | null;
}

@Injectable({ providedIn: 'root' })
export class FileDeltaSyncService implements OnDestroy {
	private readonly fileService = inject(FileService);
	private readonly filesCacheService = inject(FilesCacheService);

	private readonly folderChanged$ = new Subject<FolderChangedEvent>();
	readonly folderChanged = this.folderChanged$.asObservable();

	private readonly destroy$ = new Subject<void>();
	private pollSub: Subscription | null = null;

	private ownerId: string | null = null;
	private cursor = 0; // epoch-ms of last seen event

	start(ownerId: string): void {
		if (this.pollSub) return; // already running
		this.ownerId = ownerId;
		this.cursor = Date.now();

		this.pollSub = interval(10_000)
			.pipe(
				switchMap(() => {
					if (!this.ownerId) return EMPTY;
					return this.fileService
						.getFileEvents(this.ownerId, this.cursor)
						.pipe(catchError(() => EMPTY));
				}),
				takeUntil(this.destroy$),
			)
			.subscribe((response) => {
				if (response.events.length === 0) return;

				this.cursor = response.nextCursor;
				const affectedFolders = this.extractAffectedFolders(response.events);
				for (const { parentId } of affectedFolders) {
					this.filesCacheService.invalidateFolder(this.ownerId!, parentId);
					this.folderChanged$.next({ ownerId: this.ownerId!, parentId });
				}
			});
	}

	stop(): void {
		this.pollSub?.unsubscribe();
		this.pollSub = null;
		this.ownerId = null;
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private extractAffectedFolders(events: FileEventDto[]): FolderChangedEvent[] {
		const seen = new Set<string>();
		const folders: FolderChangedEvent[] = [];
		for (const event of events) {
			const key = `${this.ownerId}::${event.parentId ?? 'root'}`;
			if (!seen.has(key)) {
				seen.add(key);
				folders.push({ ownerId: this.ownerId!, parentId: event.parentId });
			}
		}
		return folders;
	}
}
