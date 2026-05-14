import * as childProcess from 'child_process';
import {
    afterEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import {
    getCommandResolutionPaths,
    inspectGlobalCommandResolution
} from '../global-command-resolution';
import { getPackageManagerExecutable } from '../package-manager-executable';

function mockExecFileSync(responses: Record<string, string>) {
    return vi.spyOn(childProcess, 'execFileSync').mockImplementation((command, args) => {
        const key = `${command} ${(args as string[]).join(' ')}`;
        const response = responses[key];

        if (response === undefined) {
            throw new Error(`Unexpected command: ${key}`);
        }

        return response;
    });
}

describe('global command resolution', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses where on Windows and treats same-directory shims as one install', () => {
        mockExecFileSync({
            'where ccstatusline-zh': 'C:\\Users\\Alice\\AppData\\Roaming\\npm\\ccstatusline-zh.cmd\r\nC:\\Users\\Alice\\AppData\\Roaming\\npm\\ccstatusline-zh.ps1\r\n',
            'npm.cmd prefix -g': 'C:\\Users\\Alice\\AppData\\Roaming\\npm\r\n'
        });

        const resolution = inspectGlobalCommandResolution('npm', { platform: 'win32' });

        expect(resolution.resolvedPaths).toEqual([
            'C:\\Users\\Alice\\AppData\\Roaming\\npm\\ccstatusline-zh.cmd',
            'C:\\Users\\Alice\\AppData\\Roaming\\npm\\ccstatusline-zh.ps1'
        ]);
        expect(resolution.warning).toBeNull();
    });

    it('resolves the Windows npm executable shim for execFile calls', () => {
        expect(getPackageManagerExecutable('npm', 'win32')).toBe('npm.cmd');
        expect(getPackageManagerExecutable('npm', 'linux')).toBe('npm');
        expect(getPackageManagerExecutable('bun', 'win32')).toBe('bun');
    });

    it('uses which -a on POSIX/WSL', () => {
        mockExecFileSync({ 'which -a ccstatusline-zh': '/home/alice/.bun/bin/ccstatusline-zh\n' });

        expect(getCommandResolutionPaths('ccstatusline-zh', { platform: 'linux' })).toEqual([
            '/home/alice/.bun/bin/ccstatusline-zh'
        ]);
    });

    it('warns when multiple PATH directories contain ccstatusline', () => {
        mockExecFileSync({
            'which -a ccstatusline-zh': '/home/alice/.bun/bin/ccstatusline-zh\n/usr/local/bin/ccstatusline-zh\n',
            'bun pm bin -g': '/home/alice/.bun/bin\n'
        });

        const resolution = inspectGlobalCommandResolution('bun', { platform: 'linux' });

        expect(resolution.warning).toContain('PATH 中存在多个 ccstatusline-zh 可执行文件');
        expect(resolution.warning).toContain('/home/alice/.bun/bin/ccstatusline-zh');
        expect(resolution.warning).toContain('/usr/local/bin/ccstatusline-zh');
    });

    it('ignores transient bunx status line shims when resolving global commands', () => {
        mockExecFileSync({
            'which -a ccstatusline-zh': '/var/folders/demo/T/bunx-501-ccstatusline-zh@latest/node_modules/.bin/ccstatusline-zh\n/Users/alice/.bun/bin/ccstatusline-zh\n',
            'bun pm bin -g': '/Users/alice/.bun/bin\n'
        });

        const resolution = inspectGlobalCommandResolution('bun', { platform: 'darwin' });

        expect(resolution.firstResolvedPath).toBe('/Users/alice/.bun/bin/ccstatusline-zh');
        expect(resolution.resolvedPaths).toEqual(['/Users/alice/.bun/bin/ccstatusline-zh']);
        expect(resolution.warning).toBeNull();
    });

    it('compares Windows npm prefixes with WSL /mnt paths', () => {
        mockExecFileSync({
            'which -a ccstatusline-zh': '/mnt/c/Users/Alice/AppData/Roaming/npm/ccstatusline-zh\n',
            'npm prefix -g': 'C:\\Users\\Alice\\AppData\\Roaming\\npm\n'
        });

        const resolution = inspectGlobalCommandResolution('npm', { platform: 'linux' });

        expect(resolution.expectedBinDir).toBe('C:\\Users\\Alice\\AppData\\Roaming\\npm');
        expect(resolution.warning).toBeNull();
    });

    it('warns when the first resolved binary is outside the selected manager bin directory', () => {
        mockExecFileSync({
            'which -a ccstatusline-zh': '/usr/local/bin/ccstatusline-zh\n',
            'bun pm bin -g': '/home/alice/.bun/bin\n'
        });

        const resolution = inspectGlobalCommandResolution('bun', { platform: 'linux' });

        expect(resolution.warning).toContain('不在 bun 全局 bin 目录');
        expect(resolution.warning).toContain('/usr/local/bin/ccstatusline-zh');
    });

    it('warns when ccstatusline is not resolvable after a global install', () => {
        mockExecFileSync({ 'npm prefix -g': '/usr/local\n' });

        const resolution = inspectGlobalCommandResolution('npm', { platform: 'linux' });

        expect(resolution.warning).toContain('当前 PATH 中找不到 ccstatusline-zh');
    });
});
