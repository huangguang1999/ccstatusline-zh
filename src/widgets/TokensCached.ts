import type { RenderContext } from '../types/RenderContext';

import { TokenCountWidget } from './shared/token-count-widget';

export class TokensCachedWidget extends TokenCountWidget {
    protected readonly label = '缓存: ';
    protected readonly previewTokens = 12000;

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示当前会话的缓存 Token 数'; }
    getDisplayName(): string { return '缓存 Token'; }

    protected getTokenCount(context: RenderContext): number | null {
        return context.tokenMetrics?.cachedTokens ?? null;
    }
}
