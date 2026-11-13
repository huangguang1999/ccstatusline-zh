import type { NumberFormat } from '../../types/NumberFormat';
import type {
    CustomKeybind,
    WidgetItem
} from '../../types/Widget';
import { formatPercent } from '../../utils/number-format';

import { makeLineProgressBar } from './progress-bar';
import { makeSliderBar } from './usage-display';

export type ContextSliderMode = 'none' | 'slider' | 'slider-only' | 'line';

const SLIDER_TOGGLE_KEYBIND: CustomKeybind = { key: 'p', label: '(p)进度条切换', action: 'toggle-slider' };

export function getContextSliderMode(item: WidgetItem): ContextSliderMode {
    const mode = item.metadata?.display;
    if (mode === 'slider' || mode === 'slider-only' || mode === 'line') {
        return mode;
    }
    return 'none';
}

export function cycleContextSliderMode(item: WidgetItem): WidgetItem {
    const currentMode = getContextSliderMode(item);
    const nextMode: ContextSliderMode = currentMode === 'none'
        ? 'slider'
        : currentMode === 'slider'
            ? 'slider-only'
            : currentMode === 'slider-only'
                ? 'line'
                : 'none';

    if (nextMode === 'none') {
        const nextMetadata = { ...(item.metadata ?? {}) };
        delete nextMetadata.display;
        return {
            ...item,
            metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined
        };
    }

    return {
        ...item,
        metadata: {
            ...(item.metadata ?? {}),
            display: nextMode
        }
    };
}

export function renderContextSlider(mode: ContextSliderMode, percent: number, format: NumberFormat = {}): string | null {
    if (mode === 'none') {
        return null;
    }
    if (mode === 'line') {
        return `${makeLineProgressBar(percent)} ${formatPercent(percent, format)}`;
    }
    const slider = makeSliderBar(percent);
    if (mode === 'slider') {
        return `${slider} ${formatPercent(percent, format)}`;
    }
    return slider;
}

export function getContextSliderModifierText(item: WidgetItem): string | undefined {
    const mode = getContextSliderMode(item);
    if (mode === 'slider') {
        return '(迷你进度条)';
    }
    if (mode === 'slider-only') {
        return '(仅迷你进度条)';
    }
    if (mode === 'line') {
        return '(细线进度条)';
    }
    return undefined;
}

export function getContextSliderKeybinds(): CustomKeybind[] {
    return [SLIDER_TOGGLE_KEYBIND];
}
