import type { RemoteInfo } from '../utils/git-remote';

import { GitRemoteWidgetBase } from './shared/git-remote-widget-base';

export class GitOriginOwnerWidget extends GitRemoteWidgetBase {
    protected readonly remote = 'origin';
    protected readonly previewText = 'owner';
    protected readonly previewUrl = 'https://github.com/owner/repo';

    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '显示 origin 远程的所有者/组织'; }
    getDisplayName(): string { return 'Git Origin 所有者'; }

    protected formatRemote(remote: RemoteInfo): string {
        return remote.owner;
    }
}
