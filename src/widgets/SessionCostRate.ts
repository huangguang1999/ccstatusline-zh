import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    formatCost,
    resolveNumberFormat
} from '../utils/number-format';

import {
    isMetadataFlagEnabled,
    toggleMetadataFlag
} from './shared/metadata';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

const LABEL = '费用速率: ';
const CLOCK_TIME_KEY = 'clockTime';
const TOGGLE_CLOCK_TIME_ACTION = 'toggle-clock-time';
const HOUR_MS = 60 * 60 * 1000;
// Rates over the first seconds swing wildly ($0.50 in 30s is $60/hr), so the
// widget waits for a full minute of the chosen time.
const MIN_DURATION_MS = 60 * 1000;

function isClockTime(item: WidgetItem): boolean {
    return isMetadataFlagEnabled(item, CLOCK_TIME_KEY);
}

export class SessionCostRateWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '按 Claude 的实际 API 工作时长或完整会话时长计算每小时费用'; }
    getDisplayName(): string { return '会话费用速率'; }
    getCategory(): string { return '会话'; }
    getLabelPrefix(): string { return LABEL; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return {
            displayText: this.getDisplayName(),
            modifierText: isClockTime(item) ? '(完整会话时长)' : '(实际工作时长)'
        };
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        const label = item && isClockTime(item) ? '(t)使用实际工作时长' : '(t)使用完整会话时长';
        return [{ key: 't', label, action: TOGGLE_CLOCK_TIME_ACTION }];
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        return action === TOGGLE_CLOCK_TIME_ACTION ? toggleMetadataFlag(item, CLOCK_TIME_KEY) : null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const format = resolveNumberFormat('cost', item, settings);
        if (context.isPreview) {
            // The Session Cost sample ($2.45) over 30 minutes.
            return formatRawOrLabeledValue(item, LABEL, `${formatCost(4.9, format)}/hr`);
        }

        const cost = context.data?.cost;
        const totalCost = cost?.total_cost_usd;
        // Active time is how long Claude spent generating (API time); clock time
        // is the whole session, including time spent waiting for the user.
        const durationMs = isClockTime(item) ? cost?.total_duration_ms : cost?.total_api_duration_ms;
        if (totalCost === undefined || durationMs === undefined || durationMs < MIN_DURATION_MS) {
            return null;
        }

        const perHour = totalCost / (durationMs / HOUR_MS);
        return formatRawOrLabeledValue(item, LABEL, `${formatCost(perHour, format)}/hr`);
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
