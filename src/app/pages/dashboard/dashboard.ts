import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, Observable, of, shareReplay, startWith, switchMap } from 'rxjs';
import { FileSizePipe } from '../../pipes/file-size-pipe';
import { IconFromExtensionPipe } from '../../pipes/icon-from-extension-pipe';
import { FileService } from '../../services/file.service';
import { UserService } from '../../services/user.service';
import { DashboardResponse } from '../../types/file';

interface DashboardState {
	loading: boolean;
	data: DashboardResponse | null;
	error: string | null;
}

@Component({
	selector: 'dashboard-page',
	imports: [CommonModule, RouterLink, FileSizePipe, IconFromExtensionPipe],
	templateUrl: './dashboard.html',
	styleUrl: './dashboard.css',
})
export class DashboardPage {
	private readonly fileService = inject(FileService);
	private readonly userService = inject(UserService);

	readonly dashboardState$: Observable<DashboardState> = this.userService.currentUser$.pipe(
		map((user) => user.id),
		switchMap((ownerId) =>
			this.fileService.getDashboard(ownerId).pipe(
				map((data) => ({ loading: false, data, error: null })),
				startWith({ loading: true, data: null, error: null }),
				catchError(() =>
					of({
						loading: false,
						data: null,
						error: 'Could not load dashboard data right now.',
					}),
				),
			),
		),
		shareReplay({ bufferSize: 1, refCount: true }),
	);
}
