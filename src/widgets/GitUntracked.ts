import { GitStatusFlagWidget } from './shared/git-status-widget';

export class GitUntrackedWidget extends GitStatusFlagWidget {
    protected readonly flag = 'untracked';
    protected readonly defaultSymbol = '?';

    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return '存在未跟踪文件时显示 ?'; }
    getDisplayName(): string { return 'Git 未跟踪'; }
}
