import chalk from 'chalk';
import * as childProcess from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import {
    CURRENT_VERSION,
    DEFAULT_SETTINGS,
    type InstallationMetadata
} from '../../types/Settings';
import * as claudeSettings from '../../utils/claude-settings';
import {
    getColorAnsiCode,
    updateColorMap
} from '../../utils/colors';
import { DEV_RELOAD_CHILD_ARG_PREFIX } from '../../utils/dev-reload';
import * as globalCommandResolution from '../../utils/global-command-resolution';
import * as globalPackageManager from '../../utils/global-package-manager';
import { getPackageVersion } from '../../utils/terminal';
import * as updateChecker from '../../utils/update-checker';
import {
    applyTuiImport,
    buildConfigLoadNotice,
    buildConfigLoadWarning,
    buildInvalidConfigSaveConfirm,
    classifyInstalledStatusLine,
    clearInstallMenuSelection,
    getConfirmCancelScreen,
    getPathInferredInstallation,
    getPinnedVersionMismatch
} from '../App';
import * as claudeStatus from '../claude-status';
import {
    buildMainMenuItems,
    getMainMenuInstallSelectionIndex,
    getMainMenuSelectionIndex
} from '../components/MainMenu';
import { buildManageInstallationItems } from '../components/ManageInstallationMenu';

import {
    KEYS,
    pressKey,
    renderApp,
    setUpAppSandbox,
    type AppSandbox,
    type RenderedApp
} from './helpers/render-app';
import {
    letReactCatchUp,
    waitFor
} from './helpers/wait-for-ink';

function getMenuValues(
    isClaudeInstalled: boolean,
    hasChanges: boolean,
    installation?: InstallationMetadata
): string[] {
    return buildMainMenuItems(isClaudeInstalled, hasChanges, installation)
        .map(item => item === '-' ? '-' : item.value);
}

describe('App confirm navigation helpers', () => {
    it('defaults confirmation cancel navigation to the main menu', () => {
        expect(getConfirmCancelScreen(null)).toBe('main');
        expect(getConfirmCancelScreen({
            message: 'Confirm install?',
            action: () => Promise.resolve()
        })).toBe('main');
    });

    it('returns to the install menu when the confirm dialog requests it', () => {
        expect(getConfirmCancelScreen({
            message: 'Confirm install?',
            action: () => Promise.resolve(),
            cancelScreen: 'install'
        })).toBe('install');
    });

    it('clears saved install selection when leaving the install menu', () => {
        expect(clearInstallMenuSelection({
            main: 5,
            install: 1,
            installPackage: 1
        })).toEqual({ main: 5 });

        const menuSelections = { main: 5 };

        expect(clearInstallMenuSelection(menuSelections)).toBe(menuSelections);
    });
});

describe('TUI config imports', () => {
    it('synchronizes Chalk with the imported color level', () => {
        const originalLevel = chalk.level;

        try {
            const imported = applyTuiImport(
                { ...DEFAULT_SETTINGS, colorLevel: 2 },
                { ...DEFAULT_SETTINGS, colorLevel: 0 },
                'merge',
                ['colorLevel']
            );

            expect(imported.colorLevel).toBe(0);
            expect(chalk.level).toBe(0);
        } finally {
            chalk.level = originalLevel;
        }
    });

    it('builds the named colors for the imported color level', () => {
        const originalLevel = chalk.level;

        try {
            // The color codes as built at startup in a terminal that reports 16 colors
            chalk.level = 1;
            updateColorMap();

            applyTuiImport(
                { ...DEFAULT_SETTINGS, colorLevel: 1 },
                { ...DEFAULT_SETTINGS, colorLevel: 2 },
                'merge',
                ['colorLevel']
            );

            expect(getColorAnsiCode('cyan', 'ansi256')).toBe('\x1b[38;5;30m');
        } finally {
            chalk.level = originalLevel;
            updateColorMap();
        }
    });
});

describe('Pinned version mismatch guard', () => {
    it('uses saved pinned metadata while Claude status line is still loading', () => {
        const installation: InstallationMetadata = {
            method: 'pinned',
            installedVersion: '2.2.13'
        };

        expect(classifyInstalledStatusLine(null, installation)).toEqual(installation);
    });

    it('does not block auto-update or matching pinned installs', () => {
        expect(getPinnedVersionMismatch({
            method: 'auto-update',
            packageManager: 'bun'
        }, '2.3.0', 'ccstatusline-zh')).toBeNull();

        expect(getPinnedVersionMismatch({
            method: 'pinned',
            packageManager: 'npm',
            installedVersion: '2.3.0'
        }, '2.3.0', 'ccstatusline-zh')).toBeNull();
    });

    it('blocks when the running TUI is newer than the pinned global install', () => {
        expect(getPinnedVersionMismatch({
            method: 'pinned',
            packageManager: 'bun',
            installedVersion: '2.2.13'
        }, '2.3.0', '/home/alice/.bun/bin/ccstatusline-zh')).toEqual({
            packageManager: 'bun',
            installedVersion: '2.2.13',
            runningVersion: '2.3.0',
            relaunchCommand: '/home/alice/.bun/bin/ccstatusline-zh',
            canUpdateToRunningVersion: true
        });
    });

    it('blocks without an update action when the running TUI is older than the pinned global install', () => {
        expect(getPinnedVersionMismatch({
            method: 'pinned',
            packageManager: 'npm',
            installedVersion: '2.3.0'
        }, '2.2.13', '/usr/local/bin/ccstatusline-zh')).toEqual({
            packageManager: 'npm',
            installedVersion: '2.3.0',
            runningVersion: '2.2.13',
            relaunchCommand: '/usr/local/bin/ccstatusline-zh',
            canUpdateToRunningVersion: false
        });
    });

    it('does not block for the version this session just installed', () => {
        expect(getPinnedVersionMismatch({
            method: 'pinned',
            packageManager: 'npm',
            installedVersion: '2.3.0'
        }, '2.2.13', '/usr/local/bin/ccstatusline-zh', '2.3.0')).toBeNull();

        expect(getPinnedVersionMismatch({
            method: 'pinned',
            packageManager: 'npm',
            installedVersion: '2.3.0'
        }, '2.2.13', '/usr/local/bin/ccstatusline-zh', '2.2.20')).not.toBeNull();
    });

    it('infers pinned package manager from the active PATH match', () => {
        expect(getPathInferredInstallation({
            method: 'pinned',
            installedVersion: '2.2.13'
        }, {
            packageManager: 'bun',
            resolvedPath: '/Users/alice/.bun/bin/ccstatusline-zh',
            resolvedPaths: [
                '/Users/alice/.bun/bin/ccstatusline-zh',
                '/Users/alice/.nvm/versions/node/v24.9.0/bin/ccstatusline-zh'
            ],
            binDir: '/Users/alice/.bun/bin',
            version: null,
            warning: null
        })).toEqual({
            method: 'pinned',
            packageManager: 'bun',
            installedVersion: '2.2.13'
        });
    });

    it('uses the active PATH match version when available', () => {
        expect(getPathInferredInstallation({
            method: 'pinned',
            installedVersion: '2.2.13'
        }, {
            packageManager: 'bun',
            resolvedPath: '/Users/alice/.bun/bin/ccstatusline-zh',
            resolvedPaths: ['/Users/alice/.bun/bin/ccstatusline-zh'],
            binDir: '/Users/alice/.bun/bin',
            version: '2.2.13',
            warning: null
        })).toEqual({
            method: 'pinned',
            packageManager: 'bun',
            installedVersion: '2.2.13'
        });
    });
});

describe('Main menu structure', () => {
    it('groups configure status line with terminal/global options when auto-update installed', () => {
        expect(getMenuValues(true, false, {
            method: 'auto-update',
            packageManager: 'npm'
        })).toEqual([
            'lines',
            'colors',
            'powerline',
            '-',
            'terminalConfig',
            'globalOverrides',
            'configureStatusLine',
            '-',
            'exportConfig',
            'importConfig',
            '-',
            'install',
            '-',
            'exit',
            '-',
            'starGithub'
        ]);
    });

    it('keeps install in its own section when not installed', () => {
        expect(getMenuValues(false, false)).toEqual([
            'lines',
            'colors',
            'powerline',
            '-',
            'terminalConfig',
            'globalOverrides',
            'configureStatusLine',
            '-',
            'exportConfig',
            'importConfig',
            '-',
            'install',
            '-',
            'exit',
            '-',
            'starGithub'
        ]);
    });

    it('uses manage installation for pinned installs', () => {
        const installation: InstallationMetadata = {
            method: 'pinned',
            installedVersion: '2.2.13'
        };

        expect(getMenuValues(true, false, installation)).toEqual([
            'lines',
            'colors',
            'powerline',
            '-',
            'terminalConfig',
            'globalOverrides',
            'configureStatusLine',
            '-',
            'exportConfig',
            'importConfig',
            '-',
            'manageInstallation',
            '-',
            'exit',
            '-',
            'starGithub'
        ]);

        const manageItem = buildMainMenuItems(true, false, installation)
            .find(item => item !== '-' && item.value === 'manageInstallation');

        expect(manageItem).toEqual(expect.objectContaining({ label: '🧰 管理安装' }));
    });

    it('uses a consistent update icon in manage installation and computes install selection indices', () => {
        const configureItem = buildMainMenuItems(false, false)
            .find(item => item !== '-' && item.value === 'configureStatusLine');
        const autoInstallation: InstallationMetadata = {
            method: 'auto-update',
            packageManager: 'npm'
        };
        const pinnedInstallation: InstallationMetadata = {
            method: 'pinned',
            installedVersion: '2.2.13'
        };

        // Its cache TTLs are ccstatusline's own settings, so it opens before an install
        expect(configureItem).toEqual(expect.objectContaining({ label: '🔧 配置状态行' }));
        expect(configureItem).not.toEqual(expect.objectContaining({ disabled: true }));
        expect(configureItem).not.toEqual(expect.objectContaining({ sublabel: '（请先安装）' }));
        expect(buildManageInstallationItems()[0]).toEqual(expect.objectContaining({ label: '🔄 检查更新' }));
        expect(getMainMenuInstallSelectionIndex(false)).toBe(8);
        expect(getMainMenuInstallSelectionIndex(true, autoInstallation)).toBe(8);
        expect(getMainMenuInstallSelectionIndex(true, pinnedInstallation)).toBe(8);
        expect(getMainMenuSelectionIndex(buildMainMenuItems(true, false, autoInstallation), 'install')).toBe(8);
        expect(getMainMenuSelectionIndex(
            buildMainMenuItems(true, false, pinnedInstallation),
            'manageInstallation'
        )).toBe(8);
    });
});

describe('App with a status line command it doesn\'t recognize as installed', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        vi.spyOn(claudeSettings, 'isClaudeCodeVersionAtLeast').mockReturnValue(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('edits the cache TTLs in 配置状态行 and leaves the refresh interval to an install', async () => {
        const statusLine = { type: 'command', command: '~/.claude/ccstatusline-wrapper.sh', padding: 0, refreshInterval: 10 };
        fs.mkdirSync(claudeSettings.getClaudeConfigDir(), { recursive: true });
        fs.writeFileSync(claudeSettings.getClaudeSettingsPath(), JSON.stringify({ statusLine }));
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify(DEFAULT_SETTINGS));
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('📦 Install to Claude Code');
            });
            await pressKey(rendered, KEYS.down, '▶  🎨 Edit Colors');
            await pressKey(rendered, KEYS.down, '▶  ⚡ Powerline Setup');
            await pressKey(rendered, KEYS.down, '▶  💻 Terminal Options');
            await pressKey(rendered, KEYS.down, '▶  🌐 Global Overrides');
            await pressKey(rendered, KEYS.down, '▶  🔧 配置状态行');
            await pressKey(rendered, KEYS.enter, '▶  🧮 Git Cache TTL');
            expect(rendered.getFrame()).toContain('🔄 刷新间隔 （请先安装）');

            await pressKey(rendered, KEYS.down, '▶  🔧 Custom Command Cache TTL');
            await pressKey(rendered, KEYS.enter, 'Enter custom command cache TTL in seconds (0-60): 0s');
            await pressKey(rendered, '7', 'Enter custom command cache TTL in seconds (0-60): 07s');
            await pressKey(rendered, KEYS.enter, '✓ Custom command cache TTL updated');
            await pressKey(rendered, KEYS.ctrlS, '✓ Configuration saved');

            const saved = JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8')) as { customCommandCacheTtlSeconds: number };
            expect(saved.customCommandCacheTtlSeconds).toBe(7);
            const claude = JSON.parse(fs.readFileSync(claudeSettings.getClaudeSettingsPath(), 'utf-8')) as { statusLine: unknown };
            expect(claude.statusLine).toEqual(statusLine);
        } finally {
            rendered.cleanup();
        }
    });
});

describe('Invalid-config TUI guards', () => {
    it('returns null when there is no config load error', () => {
        expect(buildConfigLoadWarning(null)).toBeNull();
        expect(buildInvalidConfigSaveConfirm(null, vi.fn())).toBeNull();
    });

    it('builds a banner that names the reason and warns about overwriting', () => {
        const warning = buildConfigLoadWarning('settings.json is not valid JSON');
        expect(warning).toContain('settings.json is not valid JSON');
        expect(warning).toContain('覆盖原文件');
    });

    it('builds a save-guard confirm dialog that returns to main on cancel', () => {
        const guard = buildInvalidConfigSaveConfirm('settings.json could not be read', vi.fn());
        expect(guard).not.toBeNull();
        expect(guard?.cancelScreen).toBe('main');
        expect(guard?.message).toContain('原文件仍保留');
        expect(guard?.message).toContain('could not be read');
    });

    it('builds a save-guard confirm dialog that returns to the given screen on cancel', () => {
        expect(buildInvalidConfigSaveConfirm('settings.json could not be read', vi.fn(), 'items')?.cancelScreen)
            .toBe('items');
    });

    it('invokes the provided onConfirm when the guard action runs', async () => {
        const onConfirm = vi.fn();
        const guard = buildInvalidConfigSaveConfirm('settings.json is not valid JSON', onConfirm);
        await guard?.action();
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('reflects the specific load-error reason in the save-guard message', () => {
        expect(buildInvalidConfigSaveConfirm('settings.json is not valid JSON', vi.fn())?.message)
            .toContain('settings.json is not valid JSON');
        expect(buildInvalidConfigSaveConfirm('settings.json is not in a valid format', vi.fn())?.message)
            .toContain('not in a valid format');
    });
});

describe('App after a global update run from the TUI', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('keeps the TUI and its unsaved edits when the pinned install moves past this version', async () => {
        const runningVersion = getPackageVersion();
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            installation: { method: 'pinned', installedVersion: runningVersion }
        }));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
        vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockReturnValue({
            packageManager: 'npm',
            resolvedPath: '/usr/local/bin/ccstatusline-zh',
            resolvedPaths: ['/usr/local/bin/ccstatusline-zh'],
            binDir: '/usr/local/bin',
            version: null,
            warning: null
        });
        vi.spyOn(updateChecker, 'checkForUpdates').mockResolvedValue({
            status: 'update-available',
            currentVersion: runningVersion,
            latestVersion: '99.0.0',
            installation: { method: 'pinned', packageManager: 'npm', installedVersion: runningVersion },
            actions: [{
                id: 'npm-global',
                packageManager: 'npm',
                command: 'npm install -g ccstatusline-zh@99.0.0',
                version: '99.0.0',
                available: true
            }]
        });
        const runUpdate = vi.spyOn(updateChecker, 'runGlobalUpdateAction').mockResolvedValue(undefined);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('主菜单');
            });

            // An unsaved edit: 颜色级别 256 → Truecolor
            await pressKey(rendered, KEYS.down, '▶  🎨 编辑颜色');
            await pressKey(rendered, KEYS.down, '▶  ⚡ Powerline 设置');
            await pressKey(rendered, KEYS.down, '▶  💻 终端选项');
            await pressKey(rendered, KEYS.enter, '▶  ▓ 颜色级别');
            await pressKey(rendered, KEYS.enter, '(Truecolor)');
            await pressKey(rendered, KEYS.escape, '💾 保存并退出');

            await pressKey(rendered, KEYS.down, '▶  🌐 全局覆盖');
            await pressKey(rendered, KEYS.down, '▶  🔧 配置状态行');
            await pressKey(rendered, KEYS.down, '▶  📤 导出配置');
            await pressKey(rendered, KEYS.down, '▶  📥 导入配置');
            await pressKey(rendered, KEYS.down, '▶  🧰 管理安装');
            await pressKey(rendered, KEYS.enter, '▶  🔄 检查更新');
            await pressKey(rendered, KEYS.enter, '检测到可用更新。');
            await pressKey(rendered, KEYS.enter, '是否执行全局更新命令？');
            await pressKey(rendered, KEYS.enter, '✓ 全局包已更新');
            expect(runUpdate).toHaveBeenCalledOnce();
            expect(rendered.getFrame()).not.toContain('固定安装版本不一致');

            await pressKey(rendered, KEYS.ctrlS, '✓ 配置已保存');
            const saved = JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8')) as {
                colorLevel: number;
                installation: InstallationMetadata;
            };
            expect(saved.colorLevel).toBe(3);
            expect(saved.installation).toEqual({ method: 'pinned', installedVersion: '99.0.0' });
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App launched through npx', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it.skipIf(process.platform === 'win32')('still guards a pinned npm install older than the running TUI', async () => {
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            installation: { method: 'pinned', installedVersion: '2.0.0' }
        }));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
        // While npx runs the TUI, its cache's bin dir comes first on PATH
        const responses: Record<string, string> = {
            'which -a ccstatusline-zh': '/home/alice/.npm/_npx/9f3c1e2a7b6d4c80/node_modules/.bin/ccstatusline-zh\n/home/alice/.npm-global/bin/ccstatusline-zh\n',
            'npm prefix -g': '/home/alice/.npm-global\n'
        };
        vi.spyOn(childProcess, 'execFileSync').mockImplementation((command, args) => {
            const key = `${command} ${(args as string[]).join(' ')}`;
            const response = responses[key];

            if (response === undefined) {
                throw new Error(`Unexpected command: ${key}`);
            }

            return response;
        });
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('固定安装版本不一致');
            });
            expect(rendered.getFrame()).toContain(`Claude Code 固定使用 ccstatusline-zh v2.0.0，当前配置界面版本为 v${getPackageVersion()}。`);
            expect(rendered.getFrame()).toContain(`更新 npm 全局安装至 v${getPackageVersion()}`);
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App live label preview', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it.each([false, true])('previews label spacing, cancels drafts, and commits or resets labels (Powerline: %s)', async (powerline) => {
        const initial = {
            ...DEFAULT_SETTINGS,
            powerline: { ...DEFAULT_SETTINGS.powerline, enabled: powerline },
            lines: [
                [{ id: 'anchor', type: 'custom-text', customText: 'Untouched line' }],
                [{ id: 'model', type: 'model', metadata: { label: '7d' } }]
            ]
        };
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify(initial));
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('主菜单');
                expect(rendered.getFrame()).toContain('7dClaude');
            });
            await pressKey(rendered, KEYS.enter, '选择要编辑组件的行');
            await pressKey(rendered, KEYS.down, '第 2 行');
            await pressKey(rendered, KEYS.enter, '编辑行 2');
            await pressKey(rendered, 'e', '(默认: "模型: ")');
            await pressKey(rendered, ' ', '7d Claude');
            await pressKey(rendered, '\x7f', '7dClaude');
            await pressKey(rendered, 'XYZ', '7dXYZClaude');
            expect(rendered.getFrame()).toContain('Untouched line');
            expect(JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8'))).toEqual(initial);

            await pressKey(rendered, KEYS.escape, '编辑行 2');
            expect(rendered.getFrame()).toContain('7dClaude');
            expect(rendered.getFrame()).not.toContain('7dXYZClaude');
            await pressKey(rendered, 'e', '(默认: "模型: ")');
            await pressKey(rendered, ' ', '7d Claude');
            await pressKey(rendered, KEYS.enter, '编辑行 2');
            expect(rendered.getFrame()).toContain('7d Claude');
            await pressKey(rendered, KEYS.ctrlS, '✓ 配置已保存');
            expect(JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8'))).toMatchObject({ lines: [initial.lines[0], [{ id: 'model', metadata: { label: '7d ' } }]] });

            await pressKey(rendered, 'e', '(默认: "模型: ")');
            await pressKey(rendered, '!', '7d !Claude');
            await pressKey(rendered, '\t', '编辑行 2');
            expect(rendered.getFrame()).toContain('模型: Claude');
            expect(rendered.getFrame()).not.toContain('7d !Claude');
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App lookup of the global ccstatusline command', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: 'ccstatusline-zh', refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    // The real lookups run `which -a`, `npm prefix -g` and `bun pm bin -g`
    it.each(['pinned', 'self-managed'] as const)('looks up a %s install once, not again for each editor key', async (method) => {
        const runningVersion = getPackageVersion();
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            lines: [[{ id: 'model', type: 'model', metadata: { label: '7d' } }]],
            ...(method === 'pinned' && { installation: { method: 'pinned', installedVersion: runningVersion } })
        }));
        const inspectActiveCommand = vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockReturnValue({
            packageManager: 'npm',
            resolvedPath: '/usr/local/bin/ccstatusline-zh',
            resolvedPaths: ['/usr/local/bin/ccstatusline-zh'],
            binDir: '/usr/local/bin',
            version: runningVersion,
            warning: null
        });
        const inspectResolution = vi.spyOn(globalCommandResolution, 'inspectGlobalCommandResolution').mockReturnValue({
            resolvedPaths: ['/usr/local/bin/ccstatusline-zh'],
            firstResolvedPath: '/usr/local/bin/ccstatusline-zh',
            expectedBinDir: '/usr/local/bin',
            warning: null
        });
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('🧰 管理安装');
            });
            await pressKey(rendered, KEYS.enter, '选择要编辑组件的行');
            await pressKey(rendered, KEYS.enter, '编辑行 1');
            await pressKey(rendered, 'e', '(默认: "模型: ")');
            await pressKey(rendered, 'X', '7dXClaude');
            await pressKey(rendered, 'Y', '7dXYClaude');
            await pressKey(rendered, 'Z', '7dXYZClaude');
            await pressKey(rendered, KEYS.enter, '编辑行 1');
            await pressKey(rendered, 'r', '(纯值)');
            await pressKey(rendered, KEYS.escape, '选择要编辑组件的行');
            await pressKey(rendered, KEYS.escape, '🧰 管理安装');

            expect(inspectActiveCommand).toHaveBeenCalledOnce();
            // Pinned installs also look up the relaunch path for the version-mismatch screen
            expect(inspectResolution).toHaveBeenCalledTimes(method === 'pinned' ? 1 : 0);
        } finally {
            rendered.cleanup();
        }
    });

    it('looks again after the TUI updates the pinned global install', async () => {
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            installation: { method: 'pinned', installedVersion: '2.0.0' }
        }));
        let versionOnDisk = '2.0.0';
        const inspectActiveCommand = vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockImplementation(() => ({
            packageManager: 'npm',
            resolvedPath: '/usr/local/bin/ccstatusline-zh',
            resolvedPaths: ['/usr/local/bin/ccstatusline-zh'],
            binDir: '/usr/local/bin',
            version: versionOnDisk,
            warning: null
        }));
        vi.spyOn(updateChecker, 'runGlobalPackageInstall').mockImplementation((packageManager, version) => {
            versionOnDisk = version;
            return Promise.resolve();
        });
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('固定安装版本不一致');
            });
            await pressKey(rendered, KEYS.enter, '✓ 全局包已更新');
            expect(rendered.getFrame()).toContain('主菜单');
            expect(inspectActiveCommand).toHaveBeenCalledTimes(2);
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App save guard for an invalid settings.json', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({ lines: 'not a list' }));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('returns to the screen Ctrl+S was pressed on, whether the save is cancelled or confirmed', async () => {
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('not in a valid format');
            });
            await pressKey(rendered, KEYS.enter, '选择要编辑组件的行');
            await pressKey(rendered, KEYS.enter, '编辑行 1');

            await pressKey(rendered, KEYS.ctrlS, '原文件仍保留在磁盘上');
            await pressKey(rendered, KEYS.escape, '编辑行 1');
            expect(fs.readFileSync(sandbox.settingsPath, 'utf-8')).toContain('not a list');

            await pressKey(rendered, KEYS.ctrlS, '原文件仍保留在磁盘上');
            await pressKey(rendered, KEYS.enter, '✓ 配置已保存');
            expect(rendered.getFrame()).toContain('编辑行 1');
            const saved = JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8')) as { lines: unknown };
            expect(Array.isArray(saved.lines)).toBe(true);
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App save with a widget whose hooks the status line command can\'t run', () => {
    const statusCommand = 'bash ~/.claude/statusline.sh';
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            lines: [[{ id: 'skills-1', type: 'skills' }], [], []]
        }));
        const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR ?? '';
        fs.mkdirSync(claudeConfigDir, { recursive: true });
        fs.writeFileSync(path.join(claudeConfigDir, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: statusCommand } }));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: statusCommand, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('explains after Ctrl+S that the hooks 未添加, then returns to the same screen', async () => {
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('主菜单');
            });
            await pressKey(rendered, KEYS.enter, '选择要编辑组件的行');

            await pressKey(rendered, KEYS.ctrlS, '未添加 技能 所需的 Claude Code Hook');
            expect(rendered.getFrame()).toContain('配置已保存');
            expect(rendered.getFrame()).toContain(statusCommand);
            expect(rendered.getFrame()).toContain('ccstatusline-zh "$@"');

            await pressKey(rendered, KEYS.enter, '选择要编辑组件的行');
            expect(rendered.getFrame()).not.toContain('未添加');
        } finally {
            rendered.cleanup();
        }
    });

    it('explains after 保存并退出 that the hooks 未添加, then exits', async () => {
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('主菜单');
            });

            // An unsaved edit, so the menu offers Save & Exit: 颜色级别 256 → Truecolor
            await pressKey(rendered, KEYS.down, '▶  🎨 编辑颜色');
            await pressKey(rendered, KEYS.down, '▶  ⚡ Powerline 设置');
            await pressKey(rendered, KEYS.down, '▶  💻 终端选项');
            await pressKey(rendered, KEYS.enter, '▶  ▓ 颜色级别');
            await pressKey(rendered, KEYS.enter, '(Truecolor)');
            await pressKey(rendered, KEYS.escape, '💾 保存并退出');

            await pressKey(rendered, KEYS.up, '▶  ⚡ Powerline 设置');
            await pressKey(rendered, KEYS.up, '▶  🎨 编辑颜色');
            await pressKey(rendered, KEYS.up, '▶  📝 编辑状态行');
            await pressKey(rendered, KEYS.up, '▶  ⭐ 喜欢 ccstatusline-zh？');
            await pressKey(rendered, KEYS.up, '▶  ❌ 不保存退出');
            await pressKey(rendered, KEYS.up, '▶  💾 保存并退出');
            await pressKey(rendered, KEYS.enter, '未添加 技能 所需的 Claude Code Hook');
            const saved = JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8')) as { colorLevel: number };
            expect(saved.colorLevel).toBe(3);

            rendered.stdin.write(KEYS.enter);
            await rendered.waitUntilExit();
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App with a migration it could not back up', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('builds a notice that says the settings shown are migrated and a save backs up the file', () => {
        expect(buildConfigLoadNotice(null)).toBeNull();
        const notice = buildConfigLoadNotice('settings.json could not be backed up before migrating');
        expect(notice).toContain('could not be backed up before migrating');
        expect(notice).toContain('showing the migrated settings');
        expect(notice).toContain('backs up the file first');
    });

    it('shows the migrated settings and saves only once the original can be backed up', async () => {
        const original = JSON.stringify({
            version: 3,
            lines: [[{ id: 'mine', type: 'custom-text', customText: 'My own line' }]]
        });
        fs.writeFileSync(sandbox.settingsPath, original);
        const backupPath = `${sandbox.settingsPath}.v3.bak`;
        // A directory where the backup goes makes the backup write fail
        fs.mkdirSync(backupPath);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('could not be backed up before migrating');
                expect(rendered.getFrame()).toContain('My own line');
            });

            await pressKey(rendered, KEYS.ctrlS, '✗ Could not save configuration');
            expect(fs.readFileSync(sandbox.settingsPath, 'utf-8')).toBe(original);

            fs.rmdirSync(backupPath);
            await pressKey(rendered, KEYS.ctrlS, '✓ Configuration saved');
            expect(fs.readFileSync(backupPath, 'utf-8')).toBe(original);
            expect(JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8'))).toMatchObject({
                version: CURRENT_VERSION,
                lines: [[{ id: 'mine', type: 'custom-text', customText: 'My own line' }]]
            });
            expect(rendered.getFrame()).not.toContain('could not be backed up');
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App main menu highlight across Ctrl+S', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify(DEFAULT_SETTINGS));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
    });

    afterEach(() => {
        sandbox.restore();
    });

    // The main menu entry the cursor is on
    function getHighlightedEntry(rendered: RenderedApp): string | undefined {
        return rendered.getFrame().split('\n').find(line => line.startsWith('▶  '))?.slice(3).trimEnd();
    }

    // Changes Color Level, so the main menu offers Save & Exit, then moves down
    // from Terminal Options, the entry last opened, to the given entry, past
    // whatever entries lie between
    async function changeAndMoveDownTo(rendered: RenderedApp, target: string): Promise<void> {
        await waitFor(() => {
            expect(rendered.getFrame()).toContain('Main Menu');
        });
        await pressKey(rendered, KEYS.down, '▶  🎨 Edit Colors');
        await pressKey(rendered, KEYS.down, '▶  ⚡ Powerline Setup');
        await pressKey(rendered, KEYS.down, '▶  💻 Terminal Options');
        await pressKey(rendered, KEYS.enter, '▶  ▓ Color Level');
        await pressKey(rendered, KEYS.enter, '(Truecolor)');
        await pressKey(rendered, KEYS.escape, '💾 Save & Exit');
        for (let steps = 0; getHighlightedEntry(rendered) !== target; steps += 1) {
            expect(steps).toBeLessThan(20);
            const before = getHighlightedEntry(rendered);
            rendered.stdin.write(KEYS.down);
            await waitFor(() => {
                expect(getHighlightedEntry(rendered)).not.toBe(before);
            });
        }
    }

    it('keeps the highlighted entry, so Enter opens it', async () => {
        const rendered = renderApp();

        try {
            await changeAndMoveDownTo(rendered, '📦 Install to Claude Code');
            await pressKey(rendered, KEYS.ctrlS, '✓ Configuration saved');
            expect(rendered.getFrame()).not.toContain('💾 Save & Exit');
            expect(rendered.getFrame()).toContain('▶  📦 Install to Claude Code');

            await pressKey(rendered, KEYS.enter, 'Install ccstatusline to Claude Code');
        } finally {
            rendered.cleanup();
        }
    });

    // Saving replaces Save & Exit and Exit without saving with a single Exit
    it.each([
        { highlighted: '💾 Save & Exit', after: '🚪 Exit', above: '📦 Install to Claude Code' },
        { highlighted: '❌ Exit without saving', after: '🚪 Exit', above: '📦 Install to Claude Code' },
        { highlighted: '⭐ Like ccstatusline? Star us on GitHub', after: '⭐ Like ccstatusline? Star us on GitHub', above: '🚪 Exit' }
    ])('highlights $after after a save from $highlighted', async ({ highlighted, after, above }) => {
        const rendered = renderApp();

        try {
            await changeAndMoveDownTo(rendered, highlighted);
            await pressKey(rendered, KEYS.ctrlS, '✓ Configuration saved');
            await waitFor(() => {
                expect(rendered.getFrame()).toContain(`▶  ${after}`);
            });

            await pressKey(rendered, KEYS.up, `▶  ${above}`);
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App preview colors in a terminal that reports fewer colors', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
        // The color codes as built at startup in a terminal that reports 16 colors
        chalk.level = 1;
        updateColorMap();
    });

    afterEach(() => {
        sandbox.restore();
    });

    function writeSettingsAt256Colors(line: unknown[]): void {
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({ ...DEFAULT_SETTINGS, colorLevel: 2, lines: [line] }));
    }

    it('draws the preview in the configured color level', async () => {
        writeSettingsAt256Colors([{ id: 'model', type: 'model' }]);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('Main Menu');
            });
            // Cyan as the status line draws it at 256 colors, not as black, its 16-color stand-in
            expect(rendered.getRawFrame()).toContain('\x1b[38;5;30mModel: Claude');
        } finally {
            rendered.cleanup();
        }
    });

    it.each([
        { case: 'without custom colors', customColors: false },
        { case: 'after the custom-colors warning', customColors: true }
    ])('redraws the preview in the color level picked in Terminal Options ($case)', async ({ customColors }) => {
        writeSettingsAt256Colors([
            { id: 'model', type: 'model' },
            ...(customColors ? [{ id: 'orange', type: 'custom-text', customText: 'Orange', color: 'ansi256:208' }] : [])
        ]);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('Main Menu');
            });
            await pressKey(rendered, KEYS.down, '▶  🎨 Edit Colors');
            await pressKey(rendered, KEYS.down, '▶  ⚡ Powerline Setup');
            await pressKey(rendered, KEYS.down, '▶  💻 Terminal Options');
            await pressKey(rendered, KEYS.enter, '▶  ▓ Color Level');
            if (customColors) {
                await pressKey(rendered, KEYS.enter, 'Custom colors detected');
            }
            await pressKey(rendered, KEYS.enter, '(Truecolor)');

            expect(rendered.getRawFrame()).toContain('\x1b[38;2;6;152;154mModel: Claude');
        } finally {
            rendered.cleanup();
        }
    });
});

function createPendingRun() {
    let finish: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>((resolve) => {
        finish = resolve;
    }));

    return { run, finish: () => { finish(); } };
}

describe('App while an install or update runs', () => {
    let sandbox: AppSandbox;
    let devReloadDir: string;
    let devReloadStateFile: string;
    const savedEnv = { ...process.env };
    const savedArgv = [...process.argv];

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        const capability = randomBytes(32).toString('hex');
        devReloadDir = path.join(os.tmpdir(), `ccstatusline-dev-reload-${capability}`);
        devReloadStateFile = path.join(devReloadDir, 'snapshot.json');
        fs.mkdirSync(devReloadDir, { mode: 0o700 });
        process.env.CCSTATUSLINE_DEV_RELOAD = '1';
        process.argv = [...savedArgv, `${DEV_RELOAD_CHILD_ARG_PREFIX}${capability}`];
    });

    afterEach(() => {
        sandbox.restore();
        process.env = { ...savedEnv };
        process.argv = [...savedArgv];
        fs.rmSync(devReloadDir, { recursive: true, force: true });
    });

    it('runs a confirmed install once, ignoring Enter, ESC and Ctrl+R until it finishes', async () => {
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(false);
        vi.spyOn(claudeSettings, 'getExistingStatusLine').mockResolvedValue(null);
        vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockReturnValue({
            packageManager: 'unknown',
            resolvedPath: null,
            resolvedPaths: [],
            binDir: null,
            version: null,
            warning: null
        });
        const globalInstall = createPendingRun();
        vi.spyOn(updateChecker, 'runGlobalPackageInstall').mockImplementation(globalInstall.run);
        const writeClaudeSettings = vi.spyOn(claudeSettings, 'installStatusLine').mockResolvedValue(undefined);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('主菜单');
            });
            await pressKey(rendered, KEYS.up, '▶  ⭐ 喜欢 ccstatusline-zh？');
            await pressKey(rendered, KEYS.up, '▶  🚪 退出');
            await pressKey(rendered, KEYS.up, '▶  📦 安装到 Claude Code');
            await pressKey(rendered, KEYS.enter, '选择安装方式');
            await pressKey(rendered, KEYS.enter, '选择包管理器');
            await pressKey(rendered, KEYS.enter, '是否继续？');

            // Yes: the global install starts and doesn't finish yet
            rendered.stdin.write(KEYS.enter);
            await waitFor(() => {
                expect(globalInstall.run).toHaveBeenCalledOnce();
            });

            rendered.stdin.write(KEYS.enter);
            await letReactCatchUp();
            rendered.stdin.write(KEYS.escape);
            await letReactCatchUp();
            rendered.stdin.write('\u0012');
            await letReactCatchUp();
            expect(fs.existsSync(devReloadStateFile)).toBe(false);
            expect(globalInstall.run).toHaveBeenCalledOnce();
            expect(rendered.getFrame()).toContain('正在处理，请稍候...');
            expect(rendered.getFrame()).not.toContain('选择安装方式');

            globalInstall.finish();
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('✓ 已安装到 Claude Code');
            });
            expect(globalInstall.run).toHaveBeenCalledOnce();
            expect(writeClaudeSettings).toHaveBeenCalledOnce();
        } finally {
            rendered.cleanup();
        }
    });

    it('runs the pinned version update once, ignoring Enter, ESC and Ctrl+R until it finishes', async () => {
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            installation: { method: 'pinned', installedVersion: '2.0.0' }
        }));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: null, refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
        vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockReturnValue({
            packageManager: 'npm',
            resolvedPath: '/usr/local/bin/ccstatusline-zh',
            resolvedPaths: ['/usr/local/bin/ccstatusline-zh'],
            binDir: '/usr/local/bin',
            version: null,
            warning: null
        });
        const globalInstall = createPendingRun();
        vi.spyOn(updateChecker, 'runGlobalPackageInstall').mockImplementation(globalInstall.run);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('固定安装版本不一致');
            });
            rendered.stdin.write(KEYS.enter);
            await waitFor(() => {
                expect(globalInstall.run).toHaveBeenCalledOnce();
            });

            rendered.stdin.write(KEYS.enter);
            await letReactCatchUp();
            rendered.stdin.write(KEYS.escape);
            await letReactCatchUp();
            rendered.stdin.write('\u0012');
            await letReactCatchUp();
            expect(fs.existsSync(devReloadStateFile)).toBe(false);
            expect(globalInstall.run).toHaveBeenCalledOnce();
            expect(rendered.getFrame()).toContain('正在将 npm 全局安装更新至 v');
            expect(rendered.getFrame()).not.toMatch(/^\s*(?:▶\s+)?退出$/m);

            globalInstall.finish();
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('✓ 全局包已更新');
            });
            expect(rendered.getFrame()).toContain('主菜单');
            expect(globalInstall.run).toHaveBeenCalledOnce();
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App when Claude settings.json breaks while the TUI is open', () => {
    let sandbox: AppSandbox;
    let claudeSettingsPath: string;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
        claudeSettingsPath = claudeSettings.getClaudeSettingsPath();
        fs.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
    });

    afterEach(() => {
        sandbox.restore();
    });

    const managedHooks = {
        UserPromptSubmit: [
            {
                _tag: 'ccstatusline-managed',
                hooks: [{ type: 'command', command: 'ccstatusline --hook' }]
            }
        ]
    };

    it.each([
        {
            name: 'settings.json no longer parses',
            // A hand edit in another window leaves a trailing comma
            content: '{ "statusLine": { "type": "command", "command": "ccstatusline", "padding": 0 }, }',
            mode: 0o644
        },
        {
            name: 'a read-only settings.json has lost its statusLine but kept the managed hooks',
            content: JSON.stringify({ hooks: managedHooks }),
            mode: 0o444
        }
    ])('fails the uninstall and keeps the npm global package when $name', async ({ content, mode }) => {
        const installation: InstallationMetadata = { method: 'pinned', installedVersion: getPackageVersion() };
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({ ...DEFAULT_SETTINGS, installation }));
        fs.writeFileSync(claudeSettingsPath, JSON.stringify({
            statusLine: { type: 'command', command: 'ccstatusline', padding: 0 },
            hooks: managedHooks
        }));
        vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockReturnValue({
            packageManager: 'npm',
            resolvedPath: '/usr/local/bin/ccstatusline',
            resolvedPaths: ['/usr/local/bin/ccstatusline'],
            binDir: '/usr/local/bin',
            version: null,
            warning: null
        });
        vi.spyOn(globalPackageManager, 'inspectGlobalPackageInstallations').mockReturnValue([
            { packageManager: 'npm', available: true, installed: true, binDir: '/usr/local/bin' },
            { packageManager: 'bun', available: false, installed: false, binDir: null }
        ]);
        // Stands in for `npm uninstall -g ccstatusline`
        const globalUninstall = vi.spyOn(globalPackageManager, 'runGlobalPackageUninstall').mockResolvedValue(undefined);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('🧰 Manage Installation');
            });
            fs.writeFileSync(claudeSettingsPath, content);
            fs.chmodSync(claudeSettingsPath, mode);

            await pressKey(rendered, KEYS.up, '▶  ⭐ Like ccstatusline?');
            await pressKey(rendered, KEYS.up, '▶  🚪 Exit');
            await pressKey(rendered, KEYS.up, '▶  🧰 Manage Installation');
            await pressKey(rendered, KEYS.enter, '▶  🔄 Check for Updates');
            await pressKey(rendered, KEYS.down, '▶  🔌 Uninstall');
            await pressKey(rendered, KEYS.enter, 'Remove from Claude Code settings only');
            await pressKey(rendered, KEYS.down, '▶  Remove Claude settings and npm global package');
            await pressKey(rendered, KEYS.enter, 'npm uninstall -g ccstatusline');
            await pressKey(rendered, KEYS.enter, '✗ Uninstall failed');

            expect(globalUninstall).not.toHaveBeenCalled();
            expect(fs.readFileSync(claudeSettingsPath, 'utf-8')).toBe(content);
            const saved = JSON.parse(fs.readFileSync(sandbox.settingsPath, 'utf-8')) as { installation?: InstallationMetadata };
            expect(saved.installation).toEqual(installation);

            await pressKey(rendered, KEYS.escape, '▶  🔄 Check for Updates');
            await pressKey(rendered, KEYS.escape, 'Main Menu');
            expect(rendered.getFrame()).toContain('🧰 Manage Installation');
            expect(rendered.getFrame()).not.toContain('📦 Install to Claude Code');
        } finally {
            rendered.cleanup();
        }
    });

    const installedStatusLine = { type: 'command', command: 'npx -y ccstatusline@latest', padding: 0, refreshInterval: 10 };

    it.each([
        {
            name: 'no longer parses',
            content: `{ "statusLine": ${JSON.stringify(installedStatusLine)}, }`
        },
        {
            name: 'has lost its statusLine',
            content: JSON.stringify({ effortLevel: 'high' })
        }
    ])('keeps the refresh interval and reports the failed save when settings.json $name', async ({ content }) => {
        fs.writeFileSync(claudeSettingsPath, JSON.stringify({ statusLine: installedStatusLine }));
        vi.spyOn(claudeSettings, 'isClaudeCodeVersionAtLeast').mockReturnValue(true);
        const rendered = renderApp();

        try {
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('🔌 Uninstall from Claude Code');
            });
            await pressKey(rendered, KEYS.down, '▶  🎨 Edit Colors');
            await pressKey(rendered, KEYS.down, '▶  ⚡ Powerline Setup');
            await pressKey(rendered, KEYS.down, '▶  💻 Terminal Options');
            await pressKey(rendered, KEYS.down, '▶  🌐 Global Overrides');
            await pressKey(rendered, KEYS.down, '▶  🔧 Configure Status Line');
            await pressKey(rendered, KEYS.enter, '🔄 Refresh Interval (10s)');
            fs.writeFileSync(claudeSettingsPath, content);

            await pressKey(rendered, KEYS.enter, 'Enter refresh interval in seconds (1-60): 10s');
            await pressKey(rendered, '\x7f', 'Enter refresh interval in seconds (1-60): 1s');
            await pressKey(rendered, '5', 'Enter refresh interval in seconds (1-60): 15s');
            await pressKey(rendered, KEYS.enter, '✗ Failed to save refresh interval');
            expect(fs.readFileSync(claudeSettingsPath, 'utf-8')).toBe(content);

            await pressKey(rendered, KEYS.enter, '🔄 Refresh Interval (10s)');
        } finally {
            rendered.cleanup();
        }
    });
});

describe('App Check for Updates', () => {
    let sandbox: AppSandbox;

    beforeEach(() => {
        sandbox = setUpAppSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    // The real check, against a registry whose latest release is `latestVersion`
    function stubLatestRelease(latestVersion: string) {
        const realCheckForUpdates = updateChecker.checkForUpdates;
        return vi.spyOn(updateChecker, 'checkForUpdates').mockImplementation(options => realCheckForUpdates({
            ...options,
            latestVersionFetcher: () => Promise.resolve(latestVersion)
        }));
    }

    function stubNpmGlobalInstall(getVersion: () => string) {
        vi.spyOn(globalPackageManager, 'inspectActiveGlobalCommand').mockImplementation(() => ({
            packageManager: 'npm',
            resolvedPath: '/usr/local/bin/ccstatusline',
            resolvedPaths: ['/usr/local/bin/ccstatusline'],
            binDir: '/usr/local/bin',
            version: getVersion(),
            warning: null
        }));
    }

    async function openCheckForUpdates(rendered: ReturnType<typeof renderApp>, expectedText: string): Promise<void> {
        await waitFor(() => {
            expect(rendered.getFrame()).toContain('Main Menu');
        });
        await pressKey(rendered, KEYS.up, '▶  ⭐ Like ccstatusline?');
        await pressKey(rendered, KEYS.up, '▶  🚪 Exit');
        await pressKey(rendered, KEYS.up, '▶  🧰 Manage Installation');
        await pressKey(rendered, KEYS.enter, '▶  🔄 Check for Updates');
        await pressKey(rendered, KEYS.enter, expectedText);
    }

    // Started through npx or bunx, the TUI can be a different version from the
    // global package that Claude Code's `ccstatusline` command runs
    it.each([
        ['offers the update to a global install older than the latest release', '2.0.0', getPackageVersion(), 'An update is available.'],
        ['reports a global install already at the latest release as up to date', '99.0.0', '99.0.0', 'ccstatusline is up to date.']
    ])('on a self-managed global install, %s', async (_label, globalVersion, latestVersion, expectedResult) => {
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: 'ccstatusline', refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
        stubNpmGlobalInstall(() => globalVersion);
        stubLatestRelease(latestVersion);
        const rendered = renderApp();

        try {
            await openCheckForUpdates(rendered, expectedResult);
            expect(rendered.getFrame()).toContain(`Current: ${globalVersion}`);
            expect(rendered.getFrame()).toContain(`Latest: ${latestVersion}`);
            expect(rendered.getFrame()).toContain('Install: Self-managed/global install');
            if (globalVersion === latestVersion) {
                expect(rendered.getFrame()).not.toContain('Run npm install -g');
            } else {
                expect(rendered.getFrame()).toContain(`Run npm install -g ccstatusline@${latestVersion}`);
            }
        } finally {
            rendered.cleanup();
        }
    });

    // Claude Code runs the checkout, so a global elsewhere on PATH says nothing
    // about whether the status line is current
    it.each([
        ['reports a checkout at the latest release as up to date, with an older global on PATH', '2.0.0', getPackageVersion(), 'ccstatusline is up to date.'],
        ['offers the update to a checkout older than the latest release, with that release on PATH', '99.0.0', '99.0.0', 'An update is available.']
    ])('on a status line that runs a local checkout, %s', async (_label, globalVersion, latestVersion, expectedResult) => {
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: 'bun /Users/dev/ccstatusline/src/ccstatusline.ts', refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
        stubNpmGlobalInstall(() => globalVersion);
        stubLatestRelease(latestVersion);
        const rendered = renderApp();

        try {
            await openCheckForUpdates(rendered, expectedResult);
            expect(rendered.getFrame()).toContain(`Current: ${getPackageVersion()}`);
            expect(rendered.getFrame()).toContain(`Latest: ${latestVersion}`);
        } finally {
            rendered.cleanup();
        }
    });

    it.each([
        ['', null],
        [' and its PATH warning', '⚠ Multiple ccstatusline binaries are on PATH.']
    ])('checks again after a global update%s, instead of offering the same update', async (_label, resolutionWarning) => {
        const runningVersion = getPackageVersion();
        fs.writeFileSync(sandbox.settingsPath, JSON.stringify({
            ...DEFAULT_SETTINGS,
            installation: { method: 'pinned', installedVersion: runningVersion }
        }));
        vi.spyOn(claudeStatus, 'loadClaudeStatusLineState').mockResolvedValue({ existingStatusLine: 'ccstatusline', refreshInterval: null });
        vi.spyOn(claudeSettings, 'isInstalled').mockResolvedValue(true);
        vi.spyOn(globalCommandResolution, 'inspectGlobalCommandResolution').mockReturnValue({
            resolvedPaths: ['/usr/local/bin/ccstatusline'],
            firstResolvedPath: '/usr/local/bin/ccstatusline',
            expectedBinDir: '/usr/local/bin',
            warning: resolutionWarning
        });
        let globalVersion = runningVersion;
        stubNpmGlobalInstall(() => globalVersion);
        const checkForUpdates = stubLatestRelease('99.0.0');
        const runUpdate = vi.spyOn(updateChecker, 'runGlobalUpdateAction').mockImplementation((action) => {
            globalVersion = action.version;
            return Promise.resolve();
        });
        const rendered = renderApp();

        try {
            await openCheckForUpdates(rendered, 'An update is available.');
            await pressKey(rendered, KEYS.enter, 'Run global update command?');
            // Yes, then Continue past the Update Complete notice when there is one
            if (resolutionWarning) {
                await pressKey(rendered, KEYS.enter, resolutionWarning);
            }
            rendered.stdin.write(KEYS.enter);
            await waitFor(() => {
                expect(rendered.getFrame()).toContain('ccstatusline is up to date.');
            });
            expect(rendered.getFrame()).toContain('Current: 99.0.0');
            expect(rendered.getFrame()).toContain('Install: Pinned global install via npm 99.0.0');
            expect(rendered.getFrame()).not.toContain('Run npm install -g');
            expect(runUpdate).toHaveBeenCalledOnce();
            expect(checkForUpdates).toHaveBeenCalledTimes(2);
        } finally {
            rendered.cleanup();
        }
    });
});
