import {
    describe,
    expect,
    it
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import { SkillsWidget } from '../Skills';

function render(item: WidgetItem, context: RenderContext): string | null {
    return new SkillsWidget().render(item, context, DEFAULT_SETTINGS);
}

describe('SkillsWidget', () => {
    it('uses v as the mode toggle keybind', () => {
        const widget = new SkillsWidget();
        expect(widget.getCustomKeybinds({ id: 'skills', type: 'skills' })).toEqual([
            { key: 'v', label: '(v)视图切换', action: 'cycle-mode' },
            { key: 'h', label: '(h)空时隐藏', action: 'toggle-hide-empty' }
        ]);
        expect(widget.getCustomKeybinds({
            id: 'skills',
            type: 'skills',
            metadata: { mode: 'list' }
        })).toEqual([
            { key: 'v', label: '(v)视图切换', action: 'cycle-mode' },
            { key: 'h', label: '(h)空时隐藏', action: 'toggle-hide-empty' },
            { key: 'l', label: '(l)数量限制', action: 'edit-list-limit' }
        ]);
    });

    it('cycles mode current -> count -> list -> current', () => {
        const widget = new SkillsWidget();
        const base: WidgetItem = { id: 'skills', type: 'skills' };
        const count = widget.handleEditorAction('cycle-mode', base);
        const list = widget.handleEditorAction('cycle-mode', count ?? base);
        const current = widget.handleEditorAction('cycle-mode', list ?? base);

        expect(count?.metadata?.mode).toBe('count');
        expect(list?.metadata?.mode).toBe('list');
        expect(current?.metadata?.mode).toBe('current');
    });

    it('clears list limit metadata when leaving list mode', () => {
        const widget = new SkillsWidget();
        const updated = widget.handleEditorAction('cycle-mode', {
            id: 'skills',
            type: 'skills',
            metadata: {
                mode: 'list',
                listLimit: '2'
            }
        });

        expect(updated?.metadata?.mode).toBe('current');
        expect(updated?.metadata?.listLimit).toBeUndefined();
    });

    it('toggles hide-when-empty metadata', () => {
        const widget = new SkillsWidget();
        const base: WidgetItem = { id: 'skills', type: 'skills' };
        const hidden = widget.handleEditorAction('toggle-hide-empty', base);
        const shown = widget.handleEditorAction('toggle-hide-empty', hidden ?? base);

        expect(hidden?.metadata?.hideWhenEmpty).toBe('true');
        expect(shown?.metadata?.hideWhenEmpty).toBe('false');
    });

    it('shows hide-when-empty in editor modifier text when enabled', () => {
        const widget = new SkillsWidget();
        const display = widget.getEditorDisplay({
            id: 'skills',
            type: 'skills',
            metadata: { hideWhenEmpty: 'true' }
        });

        expect(display.modifierText).toBe('(最近使用, 空时隐藏)');
    });

    it('shows list limit in editor modifier text when configured', () => {
        const widget = new SkillsWidget();
        const display = widget.getEditorDisplay({
            id: 'skills',
            type: 'skills',
            metadata: { mode: 'list', listLimit: '2' }
        });

        expect(display.modifierText).toBe('(唯一列表, limit: 2)');
    });

    it('renders current, count, and list modes from skills metrics', () => {
        const context: RenderContext = {
            skillsMetrics: {
                totalInvocations: 3,
                uniqueSkills: ['commit', 'review-pr'],
                lastSkill: 'review-pr'
            }
        };

        expect(render({ id: 'skills', type: 'skills' }, context)).toBe('技能: review-pr');
        expect(render({ id: 'skills', type: 'skills', metadata: { mode: 'count' } }, context)).toBe('技能: 3');
        expect(render({ id: 'skills', type: 'skills', metadata: { mode: 'list' } }, context)).toBe('技能: commit, review-pr');
        expect(render({ id: 'skills', type: 'skills', metadata: { mode: 'list', listLimit: '1' } }, context)).toBe('技能: commit');
        expect(render({ id: 'skills', type: 'skills', metadata: { mode: 'list', listLimit: '0' } }, context)).toBe('技能: commit, review-pr');
    });

    it('shows non-hidden empty outputs by default', () => {
        const context: RenderContext = {
            skillsMetrics: {
                totalInvocations: 0,
                uniqueSkills: [],
                lastSkill: null
            }
        };

        expect(render({ id: 'skills', type: 'skills' }, context)).toBe('技能: 无');
        expect(render({ id: 'skills', type: 'skills', metadata: { mode: 'count' } }, context)).toBe('技能: 0');
        expect(render({ id: 'skills', type: 'skills', metadata: { mode: 'list' } }, context)).toBe('技能: 无');
    });

    it('hides empty outputs when hide-when-empty is enabled', () => {
        const context: RenderContext = {
            skillsMetrics: {
                totalInvocations: 0,
                uniqueSkills: [],
                lastSkill: null
            }
        };

        expect(render({
            id: 'skills',
            type: 'skills',
            metadata: { hideWhenEmpty: 'true' }
        }, context)).toBeNull();
        expect(render({
            id: 'skills',
            type: 'skills',
            metadata: { mode: 'count', hideWhenEmpty: 'true' }
        }, context)).toBeNull();
        expect(render({
            id: 'skills',
            type: 'skills',
            metadata: { mode: 'list', hideWhenEmpty: 'true' }
        }, context)).toBeNull();
    });
});
