import {
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	ViewChild,
	ChangeDetectorRef,
	inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, map, startWith } from 'rxjs/operators';
import { of, BehaviorSubject } from 'rxjs';
import { IconFromExtensionPipe } from '../../../pipes/icon-from-extension-pipe';
import { InViewportDirective } from '../../../directives/in-viewport.directive';
import { FileViewBase } from '../file-view-base';
import { File } from '../../../types/file';

export interface JustifiedRow {
	files: File[];
	/** Widths in px for each file in this row (same order). */
	widths: number[];
	height: number;
}

const TARGET_ROW_HEIGHT = 200;
const GAP = 8;
/** Default aspect ratio for folders and non-image files (portrait-ish square). */
const DEFAULT_RATIO = 1;

@Component({
	selector: 'grid-view',
	imports: [CommonModule, IconFromExtensionPipe, InViewportDirective],
	templateUrl: './grid-view.html',
	styleUrl: './grid-view.css',
})
export class GridView extends FileViewBase implements OnInit, OnDestroy {
	@ViewChild('gridContainer', { static: true }) gridContainerRef!: ElementRef<HTMLElement>;

	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroy$ = new Subject<void>();
	private readonly containerWidth$ = new BehaviorSubject<number>(0);

	rows: JustifiedRow[] = [];

	ngOnInit(): void {
		this.observeContainerWidth();

		combineLatest([
			this.files$.pipe(startWith([] as File[])),
			this.containerWidth$,
		])
			.pipe(
				map(([files, width]) => this.computeRows(files ?? [], width)),
				takeUntil(this.destroy$),
			)
			.subscribe((rows) => {
				this.rows = rows;
				this.cdr.markForCheck();
			});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	trackByRow(_: number, row: JustifiedRow): string {
		return row.files.map((f) => f.id).join(',');
	}

	trackById(_: number, file: File): string {
		return file.id;
	}

	private observeContainerWidth(): void {
		const el = this.gridContainerRef.nativeElement;
		this.containerWidth$.next(el.clientWidth);

		const ro = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width !== this.containerWidth$.value) {
				this.containerWidth$.next(width);
			}
		});
		ro.observe(el);
		this.destroy$.subscribe(() => ro.disconnect());
	}

	private computeRows(files: File[], containerWidth: number): JustifiedRow[] {
		if (containerWidth <= 0 || files.length === 0) return [];

		const rows: JustifiedRow[] = [];
		let rowFiles: File[] = [];
		let rowRatioSum = 0;

		const flush = (isLast: boolean): void => {
			if (rowFiles.length === 0) return;
			const totalGap = GAP * (rowFiles.length - 1);
			const maxHeight = (containerWidth - totalGap) / rowRatioSum;
			const rowHeight = isLast
				? Math.min(TARGET_ROW_HEIGHT, maxHeight)
				: maxHeight;
			const widths = rowFiles.map((f) => this.getRatio(f) * rowHeight);
			rows.push({ files: rowFiles, widths, height: rowHeight });
			rowFiles = [];
			rowRatioSum = 0;
		};

		for (const file of files) {
			const ratio = this.getRatio(file);
			const projectedHeight =
				(containerWidth - GAP * rowFiles.length) / (rowRatioSum + ratio);

			if (rowFiles.length > 0 && projectedHeight < TARGET_ROW_HEIGHT * 0.7) {
				flush(false);
			}

			rowFiles.push(file);
			rowRatioSum += ratio;
		}

		flush(true);
		return rows;
	}

	private getRatio(file: File): number {
		if (file.isDirectory) return DEFAULT_RATIO;
		// Use the loaded thumbnail's natural dimensions when available
		const url = this.getImagePreviewUrl(file);
		if (!url) return DEFAULT_RATIO;
		// Thumbnails are square crops — treat as 1:1
		return 1;
	}
}
