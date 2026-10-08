import { GitFileCountWidget } from './shared/git-count-widget';

export class GitUntrackedFilesWidget extends GitFileCountWidget {
    protected readonly field = 'untracked';
    protected readonly label = '?:';
    protected readonly zeroLabel = '未跟踪文件数为零时';
    protected readonly previewCounts = 1;

    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return '显示未跟踪文件数'; }
    getDisplayName(): string { return 'Git 未跟踪文件'; }
}
