import type { RenderContext } from '../types/RenderContext';

import { TokenCountWidget } from './shared/token-count-widget';

export class TokensTotalWidget extends TokenCountWidget {
    protected readonly label = '合计: ';
    protected readonly previewTokens = 30600;

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示当前会话的总 Token 数（输入 + 输出 + 缓存）'; }
    getDisplayName(): string { return '总 Token'; }

    protected getTokenCount(context: RenderContext): number | null {
        return context.tokenMetrics?.totalTokens ?? null;
    }
}
