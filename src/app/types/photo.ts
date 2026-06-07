import { BehaviorSubject } from 'rxjs';
import { File } from './file';

export type YearSection = {
	year: number;
	totalCount: number;
	photos: File[];
	hasMore: boolean;
	cursor: string | null;
	gridHeight: number;
	loadStarted$: BehaviorSubject<boolean>;
	loading$: BehaviorSubject<boolean>;
};
