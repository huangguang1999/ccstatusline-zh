import type { WidgetItem } from '../types/Widget';
import type { GitChangeCounts } from '../utils/git';

import { GitLineCountWidget } from './shared/git-count-widget';
import {
    getSlotSymbol,
    type SymbolSlot
} from './shared/symbol-override';

const DELETIONS_SLOT: SymbolSlot = { id: 'symbolDeletions', label: '删除', defaultSymbol: '-' };

export class GitDeletionsWidget extends GitLineCountWidget {
    protected readonly zeroLabel = '删除行数为零时';
    protected readonly slots = [DELETIONS_SLOT];

    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return '显示 Git 删除行数'; }
    getDisplayName(): string { return 'Git 删除'; }

    protected isZero(changes: GitChangeCounts): boolean {
        return changes.deletions === 0;
    }

    protected formatCounts(item: WidgetItem, changes: GitChangeCounts): string {
        return `${getSlotSymbol(item, DELETIONS_SLOT)}${changes.deletions}`;
    }
}
