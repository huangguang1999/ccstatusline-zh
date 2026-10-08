import { GitFileCountWidget } from './shared/git-count-widget';

export class GitUnstagedFilesWidget extends GitFileCountWidget {
    protected readonly field = 'unstaged';
    protected readonly label = 'M:';
    protected readonly zeroLabel = '未暂存文件数为零时';
    protected readonly previewCounts = 2;

    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return '显示未暂存文件数'; }
    getDisplayName(): string { return 'Git 未暂存文件'; }
}
