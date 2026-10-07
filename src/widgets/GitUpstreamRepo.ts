import type { RemoteInfo } from '../utils/git-remote';

import { GitRemoteWidgetBase } from './shared/git-remote-widget-base';

export class GitUpstreamRepoWidget extends GitRemoteWidgetBase {
    protected readonly remote = 'upstream';
    protected readonly previewText = 'upstream-repo';
    protected readonly previewUrl = 'https://github.com/upstream-owner/upstream-repo';

    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return '显示 upstream 远程的仓库名'; }
    getDisplayName(): string { return 'Git Upstream 仓库'; }

    protected formatRemote(remote: RemoteInfo): string {
        return remote.repo;
    }
}
