import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { calculateContextPercentageMetrics } from '../utils/context-percentage';
import {
    formatPercent,
    resolveNumberFormat
} from '../utils/number-format';

import {
    getContextInverseModifierText,
    handleContextInverseAction,
    isContextInverse
} from './shared/context-inverse';
import {
    cycleContextSliderMode,
    getContextSliderKeybinds,
    getContextSliderMode,
    getContextSliderModifierText,
    renderContextSlider
} from './shared/context-slider';
import { formatRawOrLabeledValue } from './shared/raw-or-labeled';

export class ContextPercentageWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '显示上下文窗口已用或剩余百分比'; }
    getDisplayName(): string { return '上下文 %'; }
    getCategory(): string { return '上下文'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers = [
            getContextInverseModifierText(item),
            getContextSliderModifierText(item)
        ].filter((m): m is string => m !== undefined);
        return {
            displayText: this.getDisplayName(),
            modifierText: modifiers.length > 0 ? `(${modifiers.map(m => m.replace(/^\(|\)$/g, '')).join(', ')})` : undefined
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === 'toggle-slider') {
            return cycleContextSliderMode(item);
        }
        return handleContextInverseAction(action, item);
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const isInverse = isContextInverse(item);
        const label = isInverse ? '剩余: ' : '已用: ';
        const sliderMode = getContextSliderMode(item);
        const contextPercentageMetrics = calculateContextPercentageMetrics(context);
        const format = resolveNumberFormat('percent', item, settings);

        const formatContextPercentage = (displayPercentage: number): string => {
            const sliderResult = renderContextSlider(sliderMode, displayPercentage, format);
            return formatRawOrLabeledValue(item, label, sliderResult ?? formatPercent(displayPercentage, format));
        };

        if (context.isPreview) {
            return formatContextPercentage(isInverse ? 90.7 : 9.3);
        }

        if (contextPercentageMetrics !== null) {
            const displayPercentage = isInverse ? (100 - contextPercentageMetrics.usedPercentage) : contextPercentageMetrics.usedPercentage;
            return formatContextPercentage(displayPercentage);
        }

        return null;
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        return [
            { key: 'u', label: '(u)已用/剩余', action: 'toggle-inverse' },
            ...getContextSliderKeybinds()
        ];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
    supportsNumberFormat(): boolean { return true; }
}
