import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    HideableState,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    isInsideGitWorkTree,
    resolveGitCwd
} from '../utils/git';
import { getRemoteInfo } from '../utils/git-remote';
import type { GitReviewData } from '../utils/git-review-cache';
import {
    getCachedGitReviewData,
    getGitReviewStatusLabel,
    truncateTitle
} from '../utils/git-review-cache';
import { renderOsc8Link } from '../utils/hyperlink';

import {
    NO_GIT_HIDEABLE_STATE,
    isHidden
} from './shared/hideable';

const NO_DATA_HIDEABLE_STATE: HideableState = { key: 'no-data', label: '无 PR/MR 时' };
const STATUS_HIDEABLE_STATE: HideableState = { key: 'status', label: '状态部分' };
const TITLE_HIDEABLE_STATE: HideableState = { key: 'title', label: '标题部分' };

export interface GitPrWidgetDeps {
    getCachedGitReviewData: typeof getCachedGitReviewData;
    getProcessCwd: typeof process.cwd;
    getRemoteInfo: typeof getRemoteInfo;
    isInsideGitWorkTree: typeof isInsideGitWorkTree;
    resolveGitCwd: typeof resolveGitCwd;
}

const DEFAULT_GIT_PR_WIDGET_DEPS: GitPrWidgetDeps = {
    getCachedGitReviewData,
    getProcessCwd: () => process.cwd(),
    getRemoteInfo,
    isInsideGitWorkTree,
    resolveGitCwd
};

const PREVIEW_PR: GitReviewData = {
    number: 42,
    url: 'https://github.com/owner/repo/pull/42',
    title: '示例 PR 标题',
    state: 'OPEN',
    reviewDecision: ''
};

function resolvePrNoun(
    pr: GitReviewData | null,
    context: RenderContext,
    deps: GitPrWidgetDeps
): 'PR' | 'MR' {
    if (pr?.provider === 'glab')
        return 'MR';
    if (pr?.provider === 'gh')
        return 'PR';
    if (pr) {
        const url = pr.url.toLowerCase();
        if (url.includes('/-/merge_requests/') || url.includes('gitlab'))
            return 'MR';
    } else {
        const origin = deps.getRemoteInfo('origin', context);
        if (origin?.host.toLowerCase().includes('gitlab'))
            return 'MR';
    }
    return 'PR';
}

function buildDisplay(
    item: WidgetItem,
    pr: GitReviewData,
    showStatus: boolean,
    showTitle: boolean,
    noun: 'PR' | 'MR'
): string {
    const linkText = item.rawValue ? `#${pr.number}` : `${noun} #${pr.number}`;
    const parts: string[] = [renderOsc8Link(pr.url, linkText)];

    if (showStatus) {
        const status = getGitReviewStatusLabel(pr.state, pr.reviewDecision);
        if (status.length > 0) {
            parts.push(status);
        }
    }

    if (showTitle && pr.title.length > 0) {
        parts.push(truncateTitle(pr.title));
    }

    return parts.join(' ');
}

export class GitPrWidget implements Widget {
    constructor(private readonly deps: GitPrWidgetDeps = DEFAULT_GIT_PR_WIDGET_DEPS) {}

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示当前分支的 PR/MR 信息（可点击链接、状态、标题）'; }
    getDisplayName(): string { return 'Git PR/MR'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    getHideableStates(): HideableState[] {
        return [NO_GIT_HIDEABLE_STATE, NO_DATA_HIDEABLE_STATE, STATUS_HIDEABLE_STATE, TITLE_HIDEABLE_STATE];
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const showStatus = !isHidden(item, STATUS_HIDEABLE_STATE.key);
        const showTitle = !isHidden(item, TITLE_HIDEABLE_STATE.key);

        if (context.isPreview) {
            return buildDisplay(item, PREVIEW_PR, showStatus, showTitle, resolvePrNoun(PREVIEW_PR, context, this.deps));
        }

        if (!this.deps.isInsideGitWorkTree(context)) {
            return isHidden(item, NO_GIT_HIDEABLE_STATE.key) ? null : `(无 ${resolvePrNoun(null, context, this.deps)})`;
        }

        const cwd = this.deps.resolveGitCwd(context) ?? this.deps.getProcessCwd();
        const prData = this.deps.getCachedGitReviewData(cwd, { includeChecks: context.gitReviewNeedsChecks ?? false });
        if (!prData) {
            return isHidden(item, NO_DATA_HIDEABLE_STATE.key) ? null : `(无 ${resolvePrNoun(null, context, this.deps)})`;
        }

        return buildDisplay(item, prData, showStatus, showTitle, resolvePrNoun(prData, context, this.deps));
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
