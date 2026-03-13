import { Component, Input } from '@angular/core';
import { MetricData } from '../../../types/dashboard';
import { CommonModule } from '@angular/common';
import { DashboardMetrics } from '../../../types/file';

@Component({
	selector: 'metric-card',
	imports: [CommonModule],
	templateUrl: './metric-card.html',
	styleUrl: './metric-card.css',
})
export class MetricCard {
	@Input() dataStruct?: MetricData;
	@Input() dataSource?: DashboardMetrics;
}
