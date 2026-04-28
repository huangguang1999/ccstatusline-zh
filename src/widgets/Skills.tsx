import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';
import type { WidgetHookDef } from '../utils/hooks';
import { shouldInsertInput } from '../utils/input-guards';

import { makeModifierText } from './shared/editor-display';
import {
    isMetadataFlagEnabled,
    removeMetadataKeys,
    toggleMetadataFlag
} from './shared/metadata';

type Mode = 'current' | 'count' | 'list';
const MODES: Mode[] = ['current', 'count', 'list'];
const MODE_LABELS: Record<Mode, string> = { current: '最近使用', count: '总计数', list: '唯一列表' };
const HIDE_WHEN_EMPTY_KEY = 'hideWhenEmpty';
const LIST_LIMIT_KEY = 'listLimit';
const TOGGLE_HIDE_EMPTY_ACTION = 'toggle-hide-empty';
const EDIT_LIST_LIMIT_ACTION = 'edit-list-limit';

function parseListLimit(item: WidgetItem): number {
    const parsed = parseInt(item.metadata?.[LIST_LIMIT_KEY] ?? '0', 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return 0;
    }
    return parsed;
}

function setListLimit(item: WidgetItem, limit: number): WidgetItem {
    if (limit <= 0) {
        const { [LIST_LIMIT_KEY]: removedLimit, ...restMetadata } = item.metadata ?? {};
        void removedLimit;
        return {
            ...item,
            metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined
        };
    }

    return {
        ...item,
        metadata: {
            ...item.metadata,
            [LIST_LIMIT_KEY]: limit.toString()
        }
    };
}

export class SkillsWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return '显示来自 Hook 数据的 Claude Code 技能调用'; }
    getDisplayName(): string { return '技能'; }
    getCategory(): string { return '会话'; }
    supportsRawValue(): boolean { return true; }
    supportsColors(): boolean { return true; }

    getHooks(): WidgetHookDef[] {
        return [
            { event: 'PreToolUse', matcher: 'Skill' },
            { event: 'UserPromptSubmit' }
        ];
    }

    getCustomKeybinds(item?: WidgetItem): CustomKeybind[] {
        const keybinds: CustomKeybind[] = [
            { key: 'v', label: '(v)视图切换', action: 'cycle-mode' },
            { key: 'h', label: '(h)空时隐藏', action: TOGGLE_HIDE_EMPTY_ACTION }
        ];

        if (item && this.getMode(item) === 'list') {
            keybinds.push({ key: 'l', label: '(l)数量限制', action: EDIT_LIST_LIMIT_ACTION });
        }

        return keybinds;
    }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const modifiers = [MODE_LABELS[this.getMode(item)]];
        if (this.getMode(item) === 'list') {
            const limit = parseListLimit(item);
            if (limit > 0) {
                modifiers.push(`limit: ${limit}`);
            }
        }
        if (this.isHideWhenEmptyEnabled(item)) {
            modifiers.push('空时隐藏');
        }
        return { displayText: '技能', modifierText: makeModifierText(modifiers) };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === 'cycle-mode') {
            const next = MODES[(MODES.indexOf(this.getMode(item)) + 1) % MODES.length] ?? 'current';
            const nextItem = next === 'list' ? item : removeMetadataKeys(item, [LIST_LIMIT_KEY]);
            return { ...nextItem, metadata: { ...nextItem.metadata, mode: next } };
        }
        if (action === TOGGLE_HIDE_EMPTY_ACTION) {
            return toggleMetadataFlag(item, HIDE_WHEN_EMPTY_KEY);
        }
        return null;
    }

    renderEditor(props: WidgetEditorProps): React.ReactElement {
        return <SkillsEditor {...props} />;
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        const mode = this.getMode(item);
        const raw = item.rawValue;
        const hideWhenEmpty = this.isHideWhenEmptyEnabled(item);

        if (context.isPreview) {
            if (mode === 'current') {
                return raw ? 'commit' : '技能: commit';
            }
            if (mode === 'count') {
                return raw ? '5' : '技能: 5';
            }
            return raw ? 'commit, review-pr' : '技能: commit, review-pr';
        }

        if (mode === 'current') {
            const currentSkill = context.skillsMetrics?.lastSkill;
            if (!currentSkill) {
                if (hideWhenEmpty) {
                    return null;
                }
                return raw ? 'none' : '技能: 无';
            }
            return raw ? currentSkill : `技能: ${currentSkill}`;
        }
        if (mode === 'count') {
            const total = context.skillsMetrics?.totalInvocations ?? 0;
            if (hideWhenEmpty && total === 0) {
                return null;
            }
            return raw ? String(total) : `技能: ${total}`;
        }

        const uniqueSkills = context.skillsMetrics?.uniqueSkills ?? [];
        if (uniqueSkills.length === 0) {
            if (hideWhenEmpty) {
                return null;
            }
            return raw ? 'none' : '技能: 无';
        }

        const limit = parseListLimit(item);
        const visibleSkills = limit > 0 ? uniqueSkills.slice(0, limit) : uniqueSkills;
        const list = visibleSkills.join(', ');
        return raw ? list : `技能: ${list}`;
    }

    private getMode(item: WidgetItem): Mode {
        const mode = item.metadata?.mode;
        return mode && MODES.includes(mode as Mode) ? mode as Mode : 'current';
    }

    private isHideWhenEmptyEnabled(item: WidgetItem): boolean {
        return isMetadataFlagEnabled(item, HIDE_WHEN_EMPTY_KEY);
    }
}

const SkillsEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel, action }) => {
    const [limitInput, setLimitInput] = useState(() => parseListLimit(widget).toString());

    useInput((input, key) => {
        if (action !== EDIT_LIST_LIMIT_ACTION) {
            return;
        }

        if (key.return) {
            const parsed = parseInt(limitInput, 10);
            const limit = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
            onComplete(setListLimit(widget, limit));
        } else if (key.escape) {
            onCancel();
        } else if (key.backspace) {
            setLimitInput(limitInput.slice(0, -1));
        } else if (shouldInsertInput(input, key) && /\d/.test(input)) {
            setLimitInput(limitInput + input);
        }
    });

    if (action === EDIT_LIST_LIMIT_ACTION) {
        return (
            <Box flexDirection='column'>
                <Box>
                    <Text>输入最大显示技能数（0 为不限制）：</Text>
                    <Text>{limitInput}</Text>
                    <Text backgroundColor='gray' color='black'>{' '}</Text>
                </Box>
                <Text dimColor>按 Enter 保存，ESC 取消</Text>
            </Box>
        );
    }

    return <Text>未知编辑模式</Text>;
};
