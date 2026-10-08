import { GitStatusFlagWidget } from './shared/git-status-widget';

export class GitStagedWidget extends GitStatusFlagWidget {
    protected readonly flag = 'staged';
    protected readonly defaultSymbol = '+';

    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '存在已暂存变更时显示 +'; }
    getDisplayName(): string { return 'Git 已暂存'; }
}
