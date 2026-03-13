import { DashboardMetrics } from './file';

export type MetricData = {
	icon: string;
	accentColour: string;
	title: string;
	data: (data: DashboardMetrics) => any;
};
