import * as fs from 'node:fs';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getClaudeJsonPath } from '../utils/claude-settings';

import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '账户: ';

interface ClaudeJson { oauthAccount?: { emailAddress?: string } }

export class ClaudeAccountEmailWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示当前已登录的 Claude 账户邮箱'; }
    getDisplayName(): string { return 'Claude 账户邮箱'; }
    getCategory(): string { return '会话'; }
    getLabelPrefix(): string { return LABEL; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return formatRawOrLabeledValue(item, this.getLabelPrefix(), 'you@example.com');
        }

        try {
            const content = fs.readFileSync(getClaudeJsonPath(), 'utf-8');
            const data = JSON.parse(content) as ClaudeJson;
            const email = data.oauthAccount?.emailAddress;

            if (typeof email !== 'string' || email.length === 0) {
                return null;
            }

            return formatRawOrLabeledValue(item, this.getLabelPrefix(), email);
        } catch {
            return null;
        }
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
