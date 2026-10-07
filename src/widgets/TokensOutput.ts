import type { RenderContext } from '../types/RenderContext';
import { getContextWindowOutputTotalTokens } from '../utils/context-window';

import { TokenCountWidget } from './shared/token-count-widget';

export class TokensOutputWidget extends TokenCountWidget {
    protected readonly label = '输出: ';
    protected readonly previewTokens = 3400;

    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return '显示当前会话的输出 Token 数'; }
    getDisplayName(): string { return '输出 Token'; }

    protected getTokenCount(context: RenderContext): number | null {
        return context.tokenMetrics?.outputTokens
            ?? getContextWindowOutputTotalTokens(context.data)
            ?? null;
    }
}
