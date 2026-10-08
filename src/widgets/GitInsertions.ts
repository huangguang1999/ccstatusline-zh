import type { WidgetItem } from '../types/Widget';
import type { GitChangeCounts } from '../utils/git';

import { GitLineCountWidget } from './shared/git-count-widget';
import {
    getSlotSymbol,
    type SymbolSlot
} from './shared/symbol-override';

const INSERTIONS_SLOT: SymbolSlot = { id: 'symbolInsertions', label: '新增', defaultSymbol: '+' };

export class GitInsertionsWidget extends GitLineCountWidget {
    protected readonly zeroLabel = '新增行数为零时';
    protected readonly slots = [INSERTIONS_SLOT];

    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '显示 Git 新增行数'; }
    getDisplayName(): string { return 'Git 新增'; }

    protected isZero(changes: GitChangeCounts): boolean {
        return changes.insertions === 0;
    }

    protected formatCounts(item: WidgetItem, changes: GitChangeCounts): string {
        return `${getSlotSymbol(item, INSERTIONS_SLOT)}${changes.insertions}`;
    }
}
