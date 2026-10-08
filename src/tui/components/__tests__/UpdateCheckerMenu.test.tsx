import { render } from 'ink';
import { PassThrough } from 'node:stream';
import React from 'react';
import stripAnsi from 'strip-ansi';
import {
    describe,
    expect,
    it,
    vi,
    type Mock
} from 'vitest';

import type { ResolvedInstallationMetadata } from '../../../types/Settings';
import type { UpdateAction } from '../../../utils/update-checker';
import {
    UpdateCheckerMenu,
    type UpdateCheckerState
} from '../UpdateCheckerMenu';

class MockTtyStream extends PassThrough {
    isTTY = true;
    columns = 120;
    rows = 40;

    setRawMode() {
        return this;
    }

    ref() {
        return this;
    }

    unref() {
        return this;
    }
}

interface CapturedWriteStream extends NodeJS.WriteStream {
    clearOutput: () => void;
    getOutput: () => string;
}

function createMockStdin(): NodeJS.ReadStream {
    return new MockTtyStream() as unknown as NodeJS.ReadStream;
}

function createMockStdout(): CapturedWriteStream {
    const stream = new MockTtyStream();
    const chunks: string[] = [];

    stream.on('data', (chunk: Buffer | string) => {
        chunks.push(chunk.toString());
    });

    return Object.assign(stream as unknown as NodeJS.WriteStream, {
        clearOutput() {
            chunks.length = 0;
        },
        getOutput() {
            return stripAnsi(chunks.join(''));
        }
    });
}

// Lets work React has already queued run first. Its scheduler runs on
// setImmediate, and it attaches input listeners in an effect just after
// drawing a frame, so a key sent as soon as the frame shows could be lost.
async function letReactCatchUp() {
    for (let turn = 0; turn < 2; turn++) {
        await new Promise((resolve) => {
            setImmediate(resolve);
        });
    }
}

// Retries the assertions until they pass; a fixed delay races Ink on a busy machine
async function waitFor(assertions: () => void, timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        await new Promise((resolve) => {
            setTimeout(resolve, 10);
        });
        try {
            assertions();
            await letReactCatchUp();
            return;
        } catch (error) {
            if (Date.now() >= deadline) {
                throw error;
            }
        }
    }
}

const ENTER = '\r';
const ESCAPE = '\u001B';
const DOWN = '\u001B[B';

interface RenderedMenu {
    stdout: CapturedWriteStream;
    onBack: Mock<() => void>;
    onRefresh: Mock<() => void>;
    onRunAction: Mock<(action: UpdateAction) => void>;
    // Swaps in a new state, the way App does when its check resolves
    showState: (state: UpdateCheckerState) => void;
    // Clears the captured frames, sends one key and waits for its effect
    press: (key: string, effect: () => void) => Promise<void>;
    cleanup: () => void;
}

function renderMenu(state: UpdateCheckerState): RenderedMenu {
    const stdin = createMockStdin();
    const stdout = createMockStdout();
    const stderr = createMockStdout();
    const onBack = vi.fn<() => void>();
    const onRefresh = vi.fn<() => void>();
    const onRunAction = vi.fn<(action: UpdateAction) => void>();
    const menuFor = (menuState: UpdateCheckerState) => React.createElement(UpdateCheckerMenu, {
        state: menuState,
        onBack,
        onRefresh,
        onRunAction
    });

    const instance = render(menuFor(state), {
        stdin,
        stdout,
        stderr,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false
    });

    return {
        stdout,
        onBack,
        onRefresh,
        onRunAction,
        showState(nextState) {
            instance.rerender(menuFor(nextState));
        },
        async press(key, effect) {
            stdout.clearOutput();
            stdin.write(key);
            await waitFor(effect);
        },
        cleanup() {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    };
}

const NPM_UPDATE: UpdateAction = {
    id: 'npm-global',
    packageManager: 'npm',
    command: 'npm install -g ccstatusline-zh@2.3.0',
    version: '2.3.0',
    available: true
};

const BUN_UPDATE: UpdateAction = {
    id: 'bun-global',
    packageManager: 'bun',
    command: 'bun add -g ccstatusline-zh@2.3.0',
    version: '2.3.0',
    available: true
};

const UP_TO_DATE: UpdateCheckerState = {
    status: 'up-to-date',
    currentVersion: '2.3.0',
    latestVersion: '2.3.0',
    installation: { method: 'self-managed', packageManager: 'npm' }
};

const REGISTRY_FAILURE: UpdateCheckerState = {
    status: 'registry-failure',
    currentVersion: '2.2.13',
    installation: { method: 'unknown', packageManager: 'unknown' },
    errorMessage: 'npm registry request timed out after 5000ms'
};

function updateAvailable(
    installation: ResolvedInstallationMetadata,
    actions: UpdateAction[],
    autoUpdateLaunchCommand?: string
): UpdateCheckerState {
    return {
        status: 'update-available',
        currentVersion: '2.2.13',
        latestVersion: '2.3.0',
        installation,
        actions,
        autoUpdateLaunchCommand
    };
}

describe('UpdateCheckerMenu', () => {
    describe('while checking', () => {
        it('shows only the checking notice, then the result once the check resolves', async () => {
            const menu = renderMenu({ status: 'checking' });

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('正在查询 npm 仓库...');
                });
                expect(menu.stdout.getOutput()).toContain('检查更新');
                expect(menu.stdout.getOutput()).not.toContain('当前版本：');
                expect(menu.stdout.getOutput()).not.toContain('重新检查');

                menu.stdout.clearOutput();
                menu.showState(UP_TO_DATE);
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('ccstatusline-zh 已是最新版本。');
                });
                expect(menu.stdout.getOutput()).toContain('检查更新');
                expect(menu.stdout.getOutput()).not.toContain('正在查询 npm 仓库...');
            } finally {
                menu.cleanup();
            }
        });

        it('goes back on Escape before the check finishes', async () => {
            const menu = renderMenu({ status: 'checking' });

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('正在查询 npm 仓库...');
                });

                await menu.press(ESCAPE, () => {
                    expect(menu.onBack).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRefresh).not.toHaveBeenCalled();
            } finally {
                menu.cleanup();
            }
        });
    });

    describe('up to date', () => {
        it('shows both versions and the install method, with 重新检查 selected', async () => {
            const menu = renderMenu(UP_TO_DATE);

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('ccstatusline-zh 已是最新版本。');
                });
                const output = menu.stdout.getOutput();
                expect(output).toMatch(/^当前版本： 2\.3\.0$/m);
                expect(output).toMatch(/^最新版本： 2\.3\.0$/m);
                expect(output).toMatch(/^安装方式： 自管理 \/ 全局安装$/m);
                expect(output).toMatch(/^▶ {2}重新检查$/m);
                expect(output).toMatch(/^ {3}← 返回$/m);
                expect(output).not.toContain('检测到可用更新。');
            } finally {
                menu.cleanup();
            }
        });

        it('checks again on Enter', async () => {
            const menu = renderMenu(UP_TO_DATE);

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('▶  重新检查');
                });

                await menu.press(ENTER, () => {
                    expect(menu.onRefresh).toHaveBeenCalledTimes(1);
                });
                expect(menu.onBack).not.toHaveBeenCalled();
            } finally {
                menu.cleanup();
            }
        });

        it('goes back from ← 返回 and on Escape', async () => {
            const menu = renderMenu(UP_TO_DATE);

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('▶  重新检查');
                });

                await menu.press(DOWN, () => {
                    expect(menu.stdout.getOutput()).toContain('▶  ← 返回');
                });
                await menu.press(ENTER, () => {
                    expect(menu.onBack).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRefresh).not.toHaveBeenCalled();

                await menu.press(ESCAPE, () => {
                    expect(menu.onBack).toHaveBeenCalledTimes(2);
                });
            } finally {
                menu.cleanup();
            }
        });
    });

    describe('registry failure', () => {
        it('shows the error and no latest version', async () => {
            const menu = renderMenu(REGISTRY_FAILURE);

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('查询仓库失败：');
                });
                const output = menu.stdout.getOutput();
                expect(output).toMatch(/^查询仓库失败： npm registry request timed out after 5000ms$/m);
                expect(output).toMatch(/^当前版本： 2\.2\.13$/m);
                expect(output).toMatch(/^安装方式： 未知或未安装$/m);
                expect(output).not.toContain('最新版本：');
                expect(output).toMatch(/^▶ {2}重新检查$/m);
                expect(output).toMatch(/^ {3}← 返回$/m);
            } finally {
                menu.cleanup();
            }
        });

        it('checks again on Enter and goes back from ← 返回', async () => {
            const menu = renderMenu(REGISTRY_FAILURE);

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('▶  重新检查');
                });

                await menu.press(ENTER, () => {
                    expect(menu.onRefresh).toHaveBeenCalledTimes(1);
                });
                expect(menu.onBack).not.toHaveBeenCalled();

                await menu.press(DOWN, () => {
                    expect(menu.stdout.getOutput()).toContain('▶  ← 返回');
                });
                await menu.press(ENTER, () => {
                    expect(menu.onBack).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRefresh).toHaveBeenCalledTimes(1);
            } finally {
                menu.cleanup();
            }
        });
    });

    describe('update available', () => {
        const pinnedNpm: ResolvedInstallationMetadata = {
            method: 'pinned',
            installedVersion: '2.2.13',
            packageManager: 'npm'
        };
        const selfManagedUnknown: ResolvedInstallationMetadata = {
            method: 'self-managed',
            packageManager: 'unknown'
        };

        it('offers the update command first and runs it on Enter', async () => {
            const menu = renderMenu(updateAvailable(pinnedNpm, [NPM_UPDATE]));

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('检测到可用更新。');
                });
                const output = menu.stdout.getOutput();
                expect(output).toMatch(/^当前版本： 2\.2\.13$/m);
                expect(output).toMatch(/^最新版本： 2\.3\.0$/m);
                expect(output).toMatch(/^安装方式： 固定全局安装，包管理器：npm 2\.2\.13$/m);
                expect(output).toMatch(/^▶ {2}执行 npm install -g ccstatusline-zh@2\.3\.0$/m);
                expect(output).toMatch(/^ {3}重新检查$/m);
                expect(output).toMatch(/^ {3}← 返回$/m);
                expect(output).not.toContain('无需手动修改 Claude 配置');

                await menu.press(ENTER, () => {
                    expect(menu.onRunAction).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRunAction).toHaveBeenCalledWith({
                    id: 'npm-global',
                    packageManager: 'npm',
                    command: 'npm install -g ccstatusline-zh@2.3.0',
                    version: '2.3.0',
                    available: true
                });
                expect(menu.onRefresh).not.toHaveBeenCalled();
                expect(menu.onBack).not.toHaveBeenCalled();
            } finally {
                menu.cleanup();
            }
        });

        it('lists 重新检查 and ← 返回 after the update commands', async () => {
            const menu = renderMenu(updateAvailable(pinnedNpm, [NPM_UPDATE]));

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('▶  执行 npm install -g ccstatusline-zh@2.3.0');
                });

                await menu.press(DOWN, () => {
                    expect(menu.stdout.getOutput()).toContain('▶  重新检查');
                });
                await menu.press(ENTER, () => {
                    expect(menu.onRefresh).toHaveBeenCalledTimes(1);
                });

                await menu.press(DOWN, () => {
                    expect(menu.stdout.getOutput()).toContain('▶  ← 返回');
                });
                await menu.press(ENTER, () => {
                    expect(menu.onBack).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRunAction).not.toHaveBeenCalled();
                expect(menu.onRefresh).toHaveBeenCalledTimes(1);
            } finally {
                menu.cleanup();
            }
        });

        it('marks a command whose package manager is missing and skips to the next one', async () => {
            const menu = renderMenu(updateAvailable(selfManagedUnknown, [
                { ...NPM_UPDATE, available: false },
                BUN_UPDATE
            ]));

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('检测到可用更新。');
                });
                const output = menu.stdout.getOutput();
                expect(output).toMatch(/^安装方式： 自管理 \/ 全局安装$/m);
                expect(output).toMatch(/^ {3}执行 npm install -g ccstatusline-zh@2\.3\.0 （未检测到 npm）$/m);
                expect(output).toMatch(/^▶ {2}执行 bun add -g ccstatusline-zh@2\.3\.0$/m);

                await menu.press(ENTER, () => {
                    expect(menu.onRunAction).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRunAction).toHaveBeenCalledWith({
                    id: 'bun-global',
                    packageManager: 'bun',
                    command: 'bun add -g ccstatusline-zh@2.3.0',
                    version: '2.3.0',
                    available: true
                });
            } finally {
                menu.cleanup();
            }
        });

        it('starts on 重新检查 when neither package manager is installed', async () => {
            const menu = renderMenu(updateAvailable(selfManagedUnknown, [
                { ...NPM_UPDATE, available: false },
                { ...BUN_UPDATE, available: false }
            ]));

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('检测到可用更新。');
                });
                const output = menu.stdout.getOutput();
                expect(output).toMatch(/^ {3}执行 npm install -g ccstatusline-zh@2\.3\.0 （未检测到 npm）$/m);
                expect(output).toMatch(/^ {3}执行 bun add -g ccstatusline-zh@2\.3\.0 （未检测到 bun）$/m);
                expect(output).toMatch(/^▶ {2}重新检查$/m);

                await menu.press(ENTER, () => {
                    expect(menu.onRefresh).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRunAction).not.toHaveBeenCalled();
            } finally {
                menu.cleanup();
            }
        });

        it('tells auto-update installs that no command is needed', async () => {
            const menu = renderMenu(updateAvailable(
                { method: 'auto-update', packageManager: 'bun' },
                [],
                'bunx -y ccstatusline-zh@latest'
            ));

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('检测到可用更新。');
                });
                const output = menu.stdout.getOutput();
                expect(output).toMatch(/^安装方式： 通过 bun 自动更新$/m);
                expect(output).toMatch(/^无需手动修改 Claude 配置，因为已使用 @latest 自动跟随。$/m);
                expect(output).toMatch(/^下次调用 @latest 时会自动解析到最新版本。$/m);
                expect(output).toMatch(/^启动新 TUI 的命令： bunx -y ccstatusline-zh@latest$/m);
                expect(output).not.toContain('执行 ');
                expect(output).toMatch(/^▶ {2}重新检查$/m);
                expect(output).toMatch(/^ {3}← 返回$/m);

                await menu.press(ENTER, () => {
                    expect(menu.onRefresh).toHaveBeenCalledTimes(1);
                });

                await menu.press(DOWN, () => {
                    expect(menu.stdout.getOutput()).toContain('▶  ← 返回');
                });
                await menu.press(ENTER, () => {
                    expect(menu.onBack).toHaveBeenCalledTimes(1);
                });
                expect(menu.onRunAction).not.toHaveBeenCalled();
            } finally {
                menu.cleanup();
            }
        });
    });

    describe('install method label', () => {
        it.each<[string, ResolvedInstallationMetadata, string]>([
            ['auto-update', { method: 'auto-update', packageManager: 'npm' }, '通过 npm 自动更新'],
            ['pinned with a known version', { method: 'pinned', installedVersion: '2.2.13', packageManager: 'bun' }, '固定全局安装，包管理器：bun 2.2.13'],
            ['pinned with nothing known', { method: 'pinned', packageManager: 'unknown' }, '固定全局安装'],
            ['self-managed', { method: 'self-managed', packageManager: 'bun' }, '自管理 / 全局安装'],
            ['unknown', { method: 'unknown', packageManager: 'npm' }, '未知或未安装']
        ])('describes a %s install', async (_name, installation, label) => {
            const menu = renderMenu({ ...UP_TO_DATE, installation });

            try {
                await waitFor(() => {
                    expect(menu.stdout.getOutput()).toContain('安装方式： ');
                });
                const installLines = menu.stdout.getOutput()
                    .split('\n')
                    .filter(line => line.startsWith('安装方式： '));
                expect(installLines[0]).toBe(`安装方式： ${label}`);
            } finally {
                menu.cleanup();
            }
        });
    });
});
