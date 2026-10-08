import type { RemoteInfo } from '../utils/git-remote';

import { GitRemoteWidgetBase } from './shared/git-remote-widget-base';

export class GitOriginRepoWidget extends GitRemoteWidgetBase {
    protected readonly remote = 'origin';
    protected readonly previewText = 'repo';
    protected readonly previewUrl = 'https://github.com/owner/repo';

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示 origin 远程的仓库名'; }
    getDisplayName(): string { return 'Git Origin 仓库'; }

    protected formatRemote(remote: RemoteInfo): string {
        return remote.repo;
    }
}
