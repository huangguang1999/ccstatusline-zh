import type { RemoteInfo } from '../utils/git-remote';

import { GitRemoteWidgetBase } from './shared/git-remote-widget-base';

export class GitUpstreamOwnerRepoWidget extends GitRemoteWidgetBase {
    protected readonly remote = 'upstream';
    protected readonly previewText = 'upstream-owner/upstream-repo';
    protected readonly previewUrl = 'https://github.com/upstream-owner/upstream-repo';

    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return '以 所有者/仓库 形式显示 upstream 远程'; }
    getDisplayName(): string { return 'Git Upstream 所有者/仓库'; }

    protected formatRemote(remote: RemoteInfo): string {
        return `${remote.owner}/${remote.repo}`;
    }
}
