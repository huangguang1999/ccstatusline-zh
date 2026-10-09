import { isSafeHyperlinkUrl } from './terminal-sanitize';

export const IDE_LINK_MODES = [
    'vscode',
    'cursor'
] as const;

export type IdeLinkMode = (typeof IDE_LINK_MODES)[number];

// 移除 C0/C1 控制字符与 DEL，防止显示文本破坏 OSC 8 转义序列本身
function stripControlChars(value: string): string {
    let result = '';
    for (const ch of value) {
        const code = ch.codePointAt(0) ?? 0;
        const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f);
        if (!isControl) {
            result += ch;
        }
    }

    return result;
}

// A URL holding control characters (from a remote, a PR or settings) could end
// the sequence early and start one of its own, so it gets no link
export function renderOsc8Link(url: string, text: string): string {
    if (!isSafeHyperlinkUrl(url)) {
        return stripControlChars(text);
    }

    return `\x1b]8;;${url}\x1b\\${stripControlChars(text)}\x1b]8;;\x1b\\`;
}

export function encodeGitRefForUrlPath(ref: string): string {
    return ref
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
}

function encodeFilePathForUri(path: string): string {
    return path
        .replace(/\\/g, '/')
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
}

export function buildIdeFileUrl(filePath: string, ideLinkMode: IdeLinkMode): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const uncMatch = /^\/\/([^/]+)(\/.*)?$/.exec(normalizedPath);
    if (uncMatch?.[1]) {
        const encodedPath = encodeFilePathForUri(uncMatch[2] ?? '/');
        return `${ideLinkMode}://file//${uncMatch[1]}${encodedPath}`;
    }

    const driveMatch = /^([A-Za-z]:)(\/.*)?$/.exec(normalizedPath);
    if (driveMatch?.[1]) {
        const encodedPath = encodeFilePathForUri(driveMatch[2] ?? '/');
        return `${ideLinkMode}://file/${driveMatch[1]}${encodedPath}`;
    }

    return `${ideLinkMode}://file${encodeFilePathForUri(normalizedPath)}`;
}
