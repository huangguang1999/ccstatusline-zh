import { GitFileCountWidget } from './shared/git-count-widget';

export class GitStagedFilesWidget extends GitFileCountWidget {
    protected readonly field = 'staged';
    protected readonly label = 'S:';
    protected readonly zeroLabel = '已暂存文件数为零时';
    protected readonly previewCounts = 3;

    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return '显示已暂存文件数'; }
    getDisplayName(): string { return 'Git 已暂存文件'; }
}
