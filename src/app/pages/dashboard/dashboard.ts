import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, Observable, of, shareReplay, startWith, switchMap } from 'rxjs';
import { FileSizePipe } from '../../pipes/file-size-pipe';
import { IconFromExtensionPipe } from '../../pipes/icon-from-extension-pipe';
import { FileService } from '../../services/file.service';
import { UserService } from '../../services/user.service';
import { DashboardResponse } from '../../types/file';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { MetricCard } from './metric-card/metric-card';
import { MetricData } from '../../types/dashboard';

interface DashboardState {
	loading: boolean;
	data: DashboardResponse | null;
	error: string | null;
}

@Component({
	selector: 'dashboard-page',
	imports: [
		CommonModule,
		RouterLink,
		FileSizePipe,
		IconFromExtensionPipe,
		LoadingSpinner,
		MetricCard,
	],
	templateUrl: './dashboard.html',
	styleUrl: './dashboard.css',
})
export class DashboardPage {
	private readonly fileService = inject(FileService);
	private readonly userService = inject(UserService);
	private readonly sizePipe = inject(FileSizePipe);

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

	readonly metrics: MetricData[] = [
		{
			icon: 'bi-hdd',
			accentColour: '#e23636',
			title: 'Used storage',
			data: (data) => this.sizePipe.transform(data['usedStorageBytes']),
		},
		{
			icon: 'bi-cloud-upload',
			accentColour: '#f59e0b',
			title: 'Files uploaded',
			data: (data) => data['uploadedFiles'],
		},
		{
			icon: 'bi-image',
			accentColour: '#10b981',
			title: 'Photos & videos',
			data: (data) => data['uploadedPhotos'],
		},
		{
			icon: 'bi-share',
			accentColour: '#8b5cf6',
			title: 'Shared files',
			data: (data) => data['sharedFiles'],
		},
	];
}
