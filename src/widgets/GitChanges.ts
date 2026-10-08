import type { WidgetItem } from '../types/Widget';
import type { GitChangeCounts } from '../utils/git';

import { GitLineCountWidget } from './shared/git-count-widget';
import {
    getSlotSymbol,
    type SymbolSlot
} from './shared/symbol-override';

const INSERTIONS_SLOT: SymbolSlot = { id: 'symbolInsertions', label: '新增', defaultSymbol: '+' };
const DELETIONS_SLOT: SymbolSlot = { id: 'symbolDeletions', label: '删除', defaultSymbol: '-' };

export class GitChangesWidget extends GitLineCountWidget {
    protected readonly zeroLabel = '无变更时';
    protected readonly slots = [INSERTIONS_SLOT, DELETIONS_SLOT];

    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示 Git 变更数（+新增, -删除）'; }
    getDisplayName(): string { return 'Git 变更'; }

    protected isZero(changes: GitChangeCounts): boolean {
        return changes.insertions === 0 && changes.deletions === 0;
    }

    protected formatCounts(item: WidgetItem, changes: GitChangeCounts): string {
        return `(${getSlotSymbol(item, INSERTIONS_SLOT)}${changes.insertions},${getSlotSymbol(item, DELETIONS_SLOT)}${changes.deletions})`;
    }
}
