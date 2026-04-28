import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getContextWindowMetrics } from '../utils/context-window';
import {
    getContextConfig,
    getModelContextIdentifier
} from '../utils/model-context';

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

export class ContextPercentageUsableWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '显示有效上下文窗口已用或剩余百分比（自动压缩前最大值的 80%）'; }
    getDisplayName(): string { return '上下文 %（有效）'; }
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
        const sliderMode = getContextSliderMode(item);
        const modelIdentifier = getModelContextIdentifier(context.data?.model);
        const contextWindowMetrics = getContextWindowMetrics(context.data);
        const contextConfig = getContextConfig(modelIdentifier, contextWindowMetrics.windowSize);
        const percentLabel = isInverse ? '剩余: ' : '已用: ';
        const sliderLabel = 'Ctx: ';

        if (context.isPreview) {
            const previewPercent = isInverse ? 88.4 : 11.6;
            const sliderResult = renderContextSlider(sliderMode, previewPercent);
            if (sliderResult !== null) {
                return formatRawOrLabeledValue(item, sliderLabel, sliderResult);
            }
            return formatRawOrLabeledValue(item, percentLabel, `${previewPercent.toFixed(1)}%`);
        }

        if (contextWindowMetrics.contextLengthTokens !== null) {
            const usedPercentage = Math.min(100, (contextWindowMetrics.contextLengthTokens / contextConfig.usableTokens) * 100);
            const displayPercentage = isInverse ? (100 - usedPercentage) : usedPercentage;
            const sliderResult = renderContextSlider(sliderMode, displayPercentage);
            if (sliderResult !== null) {
                return formatRawOrLabeledValue(item, sliderLabel, sliderResult);
            }
            return formatRawOrLabeledValue(item, percentLabel, `${displayPercentage.toFixed(1)}%`);
        }

        if (context.tokenMetrics) {
            const usedPercentage = Math.min(100, (context.tokenMetrics.contextLength / contextConfig.usableTokens) * 100);
            const displayPercentage = isInverse ? (100 - usedPercentage) : usedPercentage;
            const sliderResult = renderContextSlider(sliderMode, displayPercentage);
            if (sliderResult !== null) {
                return formatRawOrLabeledValue(item, sliderLabel, sliderResult);
            }
            return formatRawOrLabeledValue(item, percentLabel, `${displayPercentage.toFixed(1)}%`);
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
}
