import {
    describe,
    expect,
    it
} from 'vitest';

import {
    buildIdeFileUrl,
    encodeGitRefForUrlPath,
    renderOsc8Link
} from '../hyperlink';

describe('renderOsc8Link', () => {
    it('emits a well-formed OSC 8 pair for a plain URL', () => {
        expect(renderOsc8Link('https://example.com', 'Docs'))
            .toBe('\x1b]8;;https://example.com\x1b\\Docs\x1b]8;;\x1b\\');
    });

    it('strips control characters from URL and text so they cannot break the escape sequence', () => {
        expect(renderOsc8Link('https://example.com/\x1b]8;;evil\x07\npath', 'Do\x1bcs\x9c'))
            .toBe('\x1b]8;;https://example.com/]8;;evilpath\x1b\\Docs\x1b]8;;\x1b\\');
    });
});

describe('encodeGitRefForUrlPath', () => {
    it('encodes reserved characters while preserving branch separators', () => {
        expect(encodeGitRefForUrlPath('feature/issue#1')).toBe('feature/issue%231');
    });
});

describe('buildIdeFileUrl', () => {
    it('builds encoded IDE links for POSIX paths', () => {
        expect(buildIdeFileUrl('/Users/example/my repo#1', 'cursor')).toBe('cursor://file/Users/example/my%20repo%231');
    });

    it('builds IDE links for Windows drive-letter paths', () => {
        expect(buildIdeFileUrl('C:/Work/my repo#1', 'vscode')).toBe('vscode://file/C:/Work/my%20repo%231');
    });

    it('builds IDE links for UNC paths', () => {
        expect(buildIdeFileUrl('\\\\server\\share\\my repo', 'cursor')).toBe('cursor://file//server/share/my%20repo');
    });
});
