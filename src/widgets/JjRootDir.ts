import type { RenderContext } from '../types/RenderContext';
import type { WidgetItem } from '../types/Widget';
import { runJjArgs } from '../utils/jj';

import { JjWidgetBase } from './shared/jj-widget-base';

export class JjRootDirWidget extends JjWidgetBase {
    protected readonly previewValue = 'my-repo';
    protected readonly noJjText = '无 JJ';

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示 Jujutsu 仓库根目录名'; }
    getDisplayName(): string { return 'JJ 根目录'; }

    protected getValue(context: RenderContext): string | null {
        return runJjArgs(['root'], context);
    }

    protected formatValue(_item: WidgetItem, rootDir: string): string {
        const trimmedRootDir = rootDir.replace(/[\\/]+$/, '');
        const normalizedRootDir = trimmedRootDir.length > 0 ? trimmedRootDir : rootDir;
        const parts = normalizedRootDir.split(/[\\/]/).filter(Boolean);
        const lastPart = parts[parts.length - 1];
        return lastPart && lastPart.length > 0 ? lastPart : normalizedRootDir;
    }

    supportsRawValue(): boolean { return false; }
}
