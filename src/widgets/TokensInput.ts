import type { RenderContext } from '../types/RenderContext';
import { getContextWindowInputTotalTokens } from '../utils/context-window';

import { TokenCountWidget } from './shared/token-count-widget';

export class TokensInputWidget extends TokenCountWidget {
    protected readonly label = '输入: ';
    protected readonly previewTokens = 15200;

    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示当前会话的输入 Token 数'; }
    getDisplayName(): string { return '输入 Token'; }

    protected getTokenCount(context: RenderContext): number | null {
        return context.tokenMetrics?.inputTokens
            ?? getContextWindowInputTotalTokens(context.data)
            ?? null;
    }
}
