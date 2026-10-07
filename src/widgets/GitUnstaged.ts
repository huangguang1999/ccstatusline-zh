import { GitStatusFlagWidget } from './shared/git-status-widget';

export class GitUnstagedWidget extends GitStatusFlagWidget {
    protected readonly flag = 'unstaged';
    protected readonly defaultSymbol = '*';

    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '存在未暂存变更时显示 *'; }
    getDisplayName(): string { return 'Git 未暂存'; }
}
