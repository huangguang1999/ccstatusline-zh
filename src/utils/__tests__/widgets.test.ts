import {
    describe,
    expect,
    it
} from 'vitest';

import {
    DEFAULT_SETTINGS,
    type Settings
} from '../../types/Settings';
import type { WidgetItemType } from '../../types/Widget';
import {
    filterWidgetCatalog,
    getAllWidgetTypes,
    getMatchSegments,
    getWidget,
    getWidgetCatalog,
    getWidgetCatalogCategories,
    isKnownWidgetType,
    type WidgetCatalogEntry
} from '../widgets';

describe('widget catalog', () => {
    const baseSettings: Settings = {
        ...DEFAULT_SETTINGS,
        powerline: { ...DEFAULT_SETTINGS.powerline }
    };

    it('builds catalog entries with categories from widget definitions', () => {
        const catalog = getWidgetCatalog(baseSettings);

        const model = catalog.find(entry => entry.type === 'model');
        const separator = catalog.find(entry => entry.type === 'separator');
        const link = catalog.find(entry => entry.type === 'link');
        const gitInsertions = catalog.find(entry => entry.type === 'git-insertions');
        const gitDeletions = catalog.find(entry => entry.type === 'git-deletions');
        const inputSpeed = catalog.find(entry => entry.type === 'input-speed');
        const outputSpeed = catalog.find(entry => entry.type === 'output-speed');
        const totalSpeed = catalog.find(entry => entry.type === 'total-speed');
        const resetTimer = catalog.find(entry => entry.type === 'reset-timer');
        const weeklyResetTimer = catalog.find(entry => entry.type === 'weekly-reset-timer');

        expect(model?.displayName).toBe('模型');
        expect(model?.category).toBe('核心');
        expect(separator?.displayName).toBe('分隔符');
        expect(separator?.category).toBe('布局');
        expect(link?.displayName).toBe('链接');
        expect(link?.category).toBe('自定义');
        expect(gitInsertions?.displayName).toBe('Git 新增');
        expect(gitInsertions?.category).toBe('Git');
        expect(gitDeletions?.displayName).toBe('Git 删除');
        expect(gitDeletions?.category).toBe('Git');
        expect(inputSpeed?.displayName).toBe('输入速度');
        expect(inputSpeed?.category).toBe('Token 速度');
        expect(outputSpeed?.displayName).toBe('输出速度');
        expect(outputSpeed?.category).toBe('Token 速度');
        expect(totalSpeed?.displayName).toBe('总速度');
        expect(totalSpeed?.category).toBe('Token 速度');
        expect(resetTimer?.displayName).toBe('时段重置计时');
        expect(resetTimer?.category).toBe('用量');
        expect(weeklyResetTimer?.displayName).toBe('周重置计时');
        expect(weeklyResetTimer?.category).toBe('用量');
    });

    it('hides manual separator when default separator is configured', () => {
        const catalog = getWidgetCatalog({
            ...baseSettings,
            defaultSeparator: '|'
        });

        const types = new Set(catalog.map(entry => entry.type));
        expect(types.has('separator')).toBe(false);
        expect(types.has('flex-separator')).toBe(true);
    });

    it('hides both separator types in powerline mode', () => {
        const catalog = getWidgetCatalog({
            ...baseSettings,
            powerline: {
                ...baseSettings.powerline,
                enabled: true
            }
        });

        const types = new Set(catalog.map(entry => entry.type));
        expect(types.has('separator')).toBe(false);
        expect(types.has('flex-separator')).toBe(false);
    });

    it('returns unique categories in discovery order', () => {
        const categories = getWidgetCatalogCategories(getWidgetCatalog(baseSettings));

        expect(categories).toContain('核心');
        expect(categories).toContain('Git');
        expect(categories).toContain('上下文');
        expect(categories).toContain('Token');
        expect(categories).toContain('Token 速度');
        expect(categories).toContain('会话');
        expect(categories).toContain('用量');
        expect(categories).toContain('环境');
        expect(categories).toContain('自定义');
        expect(categories).toContain('布局');
    });

    it('returns runtime widget instances for non-layout widget types', () => {
        const runtimeTypes = getAllWidgetTypes(baseSettings).filter(
            type => type !== 'separator' && type !== 'flex-separator'
        );

        for (const type of runtimeTypes) {
            const widget = getWidget(type);
            expect(widget).not.toBeNull();
            expect(widget?.getDisplayName().length).toBeGreaterThan(0);
        }
    });

    it('returns unique widget identifiers', () => {
        const types = getAllWidgetTypes(baseSettings);

        expect(new Set(types).size).toBe(types.length);
    });

    it('recognizes known widget and layout types', () => {
        expect(isKnownWidgetType('model')).toBe(true);
        expect(isKnownWidgetType('separator')).toBe(true);
        expect(isKnownWidgetType('flex-separator')).toBe(true);
        expect(isKnownWidgetType('unknown-widget-type')).toBe(false);
    });
});

describe('legacy widget type aliases', () => {
    it('resolves legacy git-pr type to the git-review widget instance', () => {
        const canonical = getWidget('git-review');
        const legacy = getWidget('git-pr');
        expect(canonical).not.toBeNull();
        expect(legacy).toBe(canonical);
    });

    it('treats legacy git-pr as a known widget type', () => {
        expect(isKnownWidgetType('git-pr')).toBe(true);
    });

    it('does not list the legacy git-pr type in the catalog', () => {
        const catalog = getWidgetCatalog({
            ...DEFAULT_SETTINGS,
            powerline: { ...DEFAULT_SETTINGS.powerline }
        });
        const types = new Set(catalog.map(entry => entry.type));
        expect(types.has('git-review')).toBe(true);
        expect(types.has('git-pr')).toBe(false);
    });
});

describe('widget catalog filtering', () => {
    const catalog = getWidgetCatalog({
        ...DEFAULT_SETTINGS,
        powerline: { ...DEFAULT_SETTINGS.powerline }
    });

    it('matches display name with case-insensitive partial search', () => {
        const results = filterWidgetCatalog(catalog, '全部', 'Git 分');
        expect(results[0]?.type).toBe('git-branch');
    });

    it('matches type string search such as git-worktree', () => {
        const results = filterWidgetCatalog(catalog, '全部', 'git-worktree');
        expect(results[0]?.type).toBe('git-worktree');
    });

    it('matches description search', () => {
        const results = filterWidgetCatalog(catalog, '全部', '工作目录');
        expect(results.some(entry => entry.type === 'current-working-dir')).toBe(true);
    });

    it('applies category and query filters together', () => {
        const results = filterWidgetCatalog(catalog, 'Git', 'context');
        expect(results).toHaveLength(0);
    });

    it('fuzzy-matches initials across word boundaries (gb → Git Branch)', () => {
        const fuzzyCatalog: WidgetCatalogEntry[] = [
            { type: 'git-branch' as WidgetItemType, displayName: 'Git Branch', description: '', category: 'Git', searchText: 'git branch git-branch' },
            { type: 'git-deletions' as WidgetItemType, displayName: 'Git Deletions', description: '', category: 'Git', searchText: 'git deletions git-deletions' }
        ];
        const results = filterWidgetCatalog(fuzzyCatalog, '全部', 'gb');
        expect(results[0]?.type).toBe('git-branch');
    });

    it('prioritizes display-name fuzzy matches over description substring hits', () => {
        const fuzzyCatalog: WidgetCatalogEntry[] = [
            { type: 'terminal-width' as WidgetItemType, displayName: 'Terminal Width', description: '', category: 'Env', searchText: 'terminal width terminal-width' },
            { type: 'other' as WidgetItemType, displayName: 'Other', description: 'something with tw inside', category: 'Env', searchText: 'other something with tw inside' }
        ];
        const results = filterWidgetCatalog(fuzzyCatalog, '全部', 'tw');
        expect(results[0]?.type).toBe('terminal-width');
    });

    it('prioritizes word-initial fuzzy matches over incidental subsequence matches', () => {
        const fuzzyCatalog: WidgetCatalogEntry[] = [
            { type: 'tokens-cached' as WidgetItemType, displayName: 'Tokens Cached', description: '', category: 'Token', searchText: 'tokens cached tokens-cached' },
            { type: 'tokens-input' as WidgetItemType, displayName: 'Tokens Input', description: '', category: 'Token', searchText: 'tokens input tokens-input' },
            { type: 'tokens-output' as WidgetItemType, displayName: 'Tokens Output', description: '', category: 'Token', searchText: 'tokens output tokens-output' },
            { type: 'tokens-total' as WidgetItemType, displayName: 'Tokens Total', description: '', category: 'Token', searchText: 'tokens total tokens-total' }
        ];
        expect(filterWidgetCatalog(fuzzyCatalog, '全部', 'tc')[0]?.type).toBe('tokens-cached');
        expect(filterWidgetCatalog(fuzzyCatalog, '全部', 'ti')[0]?.type).toBe('tokens-input');
        expect(filterWidgetCatalog(fuzzyCatalog, '全部', 'to')[0]?.type).toBe('tokens-output');
    });

    it('ranks exact substring matches above fuzzy matches', () => {
        const rankingCatalog: WidgetCatalogEntry[] = [
            {
                type: 'exact-match' as WidgetItemType,
                displayName: 'Git Branch',
                description: 'Exact substring match',
                category: 'Core',
                searchText: 'git branch exact substring match exact-match'
            },
            {
                type: 'fuzzy-match' as WidgetItemType,
                displayName: 'Global Input Timer',
                description: 'Fuzzy-only match',
                category: 'Core',
                searchText: 'global input timer fuzzy-only match fuzzy-match'
            }
        ];

        const results = filterWidgetCatalog(rankingCatalog, '全部', 'git');
        expect(results.map(entry => entry.type)).toEqual(['exact-match', 'fuzzy-match']);
    });

    it('returns no results when query chars cannot form a subsequence in any entry', () => {
        const results = filterWidgetCatalog(catalog, '全部', 'zzz');
        expect(results).toHaveLength(0);
    });

    it('prioritizes name match before type and description matches', () => {
        const rankingCatalog: WidgetCatalogEntry[] = [
            {
                type: 'alpha' as WidgetItemType,
                displayName: 'Git 分支',
                description: 'Primary match',
                category: '核心',
                searchText: 'git branch primary match alpha'
            },
            {
                type: 'git-type-only' as WidgetItemType,
                displayName: 'Branch',
                description: 'Type fallback match',
                category: '核心',
                searchText: 'branch type fallback match git-type-only'
            },
            {
                type: 'desc-only' as WidgetItemType,
                displayName: 'Branch',
                description: 'Description contains git',
                category: '核心',
                searchText: 'branch description contains git desc-only'
            }
        ];

        const results = filterWidgetCatalog(rankingCatalog, '全部', 'git');
        expect(results.map(entry => entry.type)).toEqual(['alpha', 'git-type-only', 'desc-only']);
    });
});

describe('getMatchSegments', () => {
    it('returns single unmatched segment when query is empty', () => {
        expect(getMatchSegments('Git Branch', '')).toEqual([{ text: 'Git Branch', matched: false }]);
    });

    it('highlights exact substring match', () => {
        const segments = getMatchSegments('Git Branch', 'git');
        expect(segments).toEqual([
            { text: 'Git', matched: true },
            { text: ' Branch', matched: false }
        ]);
    });

    it('highlights exact substring in the middle', () => {
        const segments = getMatchSegments('Git Branch', 'it B');
        expect(segments).toEqual([
            { text: 'G', matched: false },
            { text: 'it B', matched: true },
            { text: 'ranch', matched: false }
        ]);
    });

    it('highlights fuzzy match positions when no substring match exists', () => {
        const segments = getMatchSegments('Git Branch', 'gb');
        const matched = segments.filter(s => s.matched).map(s => s.text).join('');
        expect(matched.toLowerCase()).toBe('gb');
    });

    it('prefers word-initial fuzzy positions over incidental interior-letter matches', () => {
        expect(getMatchSegments('Tokens Output', 'to')).toEqual([
            { text: 'T', matched: true },
            { text: 'okens ', matched: false },
            { text: 'O', matched: true },
            { text: 'utput', matched: false }
        ]);
    });

    it('returns unmatched segment when query chars cannot form a subsequence', () => {
        expect(getMatchSegments('Git Branch', 'zzz')).toEqual([{ text: 'Git Branch', matched: false }]);
    });

    it('is case-insensitive but preserves original casing in output', () => {
        const segments = getMatchSegments('Git Branch', 'GIT');
        expect(segments[0]).toEqual({ text: 'Git', matched: true });
    });
});
