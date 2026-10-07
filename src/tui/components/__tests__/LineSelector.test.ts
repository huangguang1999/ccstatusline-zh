import { render } from 'ink';
import { PassThrough } from 'node:stream';
import React from 'react';
import stripAnsi from 'strip-ansi';
import {
    describe,
    expect,
    it,
    vi
} from 'vitest';

import {
    DEFAULT_SETTINGS,
    type Settings
} from '../../../types/Settings';
import type { WidgetItem } from '../../../types/Widget';
import {
    LineSelector,
    type LineSelectorProps
} from '../LineSelector';

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
    getLastFrame: () => string;
}

function createMockStdin(): NodeJS.ReadStream {
    return new MockTtyStream() as unknown as NodeJS.ReadStream;
}

function createMockStdout(): CapturedWriteStream {
    const stream = new MockTtyStream();
    const chunks: string[] = [];
    let lastFrame = '';

    stream.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        chunks.push(text);
        // In debug mode Ink writes each frame whole, in one write. It also
        // writes bare cursor codes, which carry no text and aren't frames.
        if (stripAnsi(text) !== '') {
            lastFrame = text;
        }
    });

    return Object.assign(stream as unknown as NodeJS.WriteStream, {
        clearOutput() {
            chunks.length = 0;
        },
        getOutput() {
            return chunks.join('');
        },
        getLastFrame() {
            return lastFrame;
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

const ESC = '\u001B';
const ENTER = '\r';
const UP_ARROW = '\u001B[A';
const DOWN_ARROW = '\u001B[B';

const FULL_EDITING_HELP = '(a) 添加新行，(d) 删除行，(m) 移动行，ESC 返回';
const SINGLE_LINE_EDITING_HELP = '(a) 添加新行，ESC 返回';

const ONE_WIDGET: WidgetItem[] = [{ id: '1', type: 'model' }];
const TWO_WIDGETS: WidgetItem[] = [{ id: '2', type: 'git-branch' }, { id: '3', type: 'tokens-input' }];
const EMPTY: WidgetItem[] = [];

function powerlineSettings(enabled: boolean, theme: string | undefined): Settings {
    return {
        ...DEFAULT_SETTINGS,
        powerline: { ...DEFAULT_SETTINGS.powerline, enabled, theme }
    };
}

type RenderProps = Omit<LineSelectorProps, 'onSelect' | 'onBack' | 'onLinesUpdate'>;

function renderLineSelector(props: RenderProps) {
    const stdin = createMockStdin();
    const stdout = createMockStdout();
    const stderr = createMockStdout();
    const onSelect = vi.fn<(line: number) => void>();
    const onBack = vi.fn<() => void>();
    const onLinesUpdate = vi.fn<(lines: WidgetItem[][]) => void>();

    const element = (overrides: Partial<RenderProps> = {}) => React.createElement(LineSelector, {
        ...props,
        ...overrides,
        onSelect,
        onBack,
        onLinesUpdate
    });

    const instance = render(element(), {
        stdin,
        stdout,
        stderr,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false
    });

    const frame = () => stripAnsi(stdout.getLastFrame());

    return {
        onSelect,
        onBack,
        onLinesUpdate,
        frame,
        // The latest frame's line and Back rows, trimmed. '▶' marks the
        // highlighted row and '◆' the line being moved.
        rows: () => frame()
            .split('\n')
            .map(row => row.trim())
            .filter(row => row.includes('☰ 第') || row.includes('← 返回')),
        // Sends one key without waiting; follow with waitFor on what it changes
        press: (input: string) => {
            stdout.clearOutput();
            stdin.write(input);
        },
        // Sends one key that must do nothing: waits until Ink has read it from
        // stdin (its handlers run in that same read), then checks nothing redrew
        pressIgnored: async (input: string) => {
            stdout.clearOutput();
            stdin.write(input);
            await waitFor(() => {
                expect(stdin.readableLength).toBe(0);
            });
            expect(stripAnsi(stdout.getOutput())).toBe('');
        },
        rerender: (overrides: Partial<RenderProps>) => {
            instance.rerender(element(overrides));
        },
        cleanup: () => {
            instance.unmount();
            instance.cleanup();
            stdin.destroy();
            stdout.destroy();
            stderr.destroy();
        }
    };
}

describe('LineSelector', () => {
    it('lists each line with its widget count and highlights the initial selection', async () => {
        const view = renderLineSelector({ lines: [TWO_WIDGETS, EMPTY, ONE_WIDGET], initialSelection: 1 });

        try {
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (2 个组件)',
                    '▶  ☰ 第 2 行 (空)',
                    '☰ 第 3 行 (1 个组件)',
                    '← 返回'
                ]);
            });
            const frame = view.frame();
            expect(frame).toContain('选择要编辑的行');
            expect(frame).toContain('选择要配置的状态栏行');
            expect(frame).toContain('ESC 返回');
            expect(frame).not.toContain('(a) to append');
        } finally {
            view.cleanup();
        }
    });

    it('selects the line the arrows move to on Enter', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY, TWO_WIDGETS] });

        try {
            await waitFor(() => {
                expect(view.rows()[0]).toBe('▶  ☰ 第 1 行 (1 个组件)');
            });

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()[1]).toBe('▶  ☰ 第 2 行 (空)');
            });

            view.press(ENTER);
            await waitFor(() => {
                expect(view.onSelect).toHaveBeenCalledWith(1);
            });
            expect(view.onSelect).toHaveBeenCalledTimes(1);
            expect(view.onBack).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('goes back on ESC', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY] });

        try {
            await waitFor(() => {
                expect(view.rows()[0]).toBe('▶  ☰ 第 1 行 (1 个组件)');
            });

            view.press(ESC);
            await waitFor(() => {
                expect(view.onBack).toHaveBeenCalledTimes(1);
            });
            expect(view.onSelect).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('goes back from the Back entry, which Up reaches by wrapping from the first line', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY] });

        try {
            await waitFor(() => {
                expect(view.rows()[0]).toBe('▶  ☰ 第 1 行 (1 个组件)');
            });

            view.press(UP_ARROW);
            await waitFor(() => {
                expect(view.rows().at(-1)).toBe('▶  ← 返回');
            });

            view.press(ENTER);
            await waitFor(() => {
                expect(view.onBack).toHaveBeenCalledTimes(1);
            });
            expect(view.onSelect).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('ignores the editing keys when editing is not allowed', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY, TWO_WIDGETS] });

        try {
            await waitFor(() => {
                expect(view.rows()).toHaveLength(4);
            });

            await view.pressIgnored('a');
            await view.pressIgnored('d');
            await view.pressIgnored('m');
            expect(view.onLinesUpdate).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('offers only appending for a single line, and appends an empty line it highlights', async () => {
        const view = renderLineSelector({
            lines: [ONE_WIDGET],
            allowEditing: true,
            title: '选择要编辑组件的行'
        });

        try {
            await waitFor(() => {
                expect(view.frame()).toContain(SINGLE_LINE_EDITING_HELP);
            });
            expect(view.frame()).toContain('选择要编辑组件的行');

            // The only line can't be deleted or moved
            await view.pressIgnored('d');
            await view.pressIgnored('m');

            view.press('a');
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (1 个组件)',
                    '▶  ☰ 第 2 行 (空)',
                    '← 返回'
                ]);
            });
            expect(view.frame()).toContain(FULL_EDITING_HELP);
            expect(view.onLinesUpdate).toHaveBeenCalledTimes(1);
            expect(view.onLinesUpdate).toHaveBeenCalledWith([ONE_WIDGET, EMPTY]);

            view.press(ENTER);
            await waitFor(() => {
                expect(view.onSelect).toHaveBeenCalledWith(1);
            });
        } finally {
            view.cleanup();
        }
    });

    it('deletes the highlighted line after Yes and highlights the line above it', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY, TWO_WIDGETS], allowEditing: true });

        try {
            await waitFor(() => {
                expect(view.frame()).toContain(FULL_EDITING_HELP);
            });

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()[1]).toBe('▶  ☰ 第 2 行 (空)');
            });

            view.press('d');
            await waitFor(() => {
                expect(view.frame()).toContain('确定要删除此行吗？');
            });
            expect(view.frame()).toContain('☰ 第 2 行 (空)');
            expect(view.frame()).toMatch(/▶\s+是/);
            expect(view.frame()).toContain('否');

            view.press(ENTER);
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '▶  ☰ 第 1 行 (1 个组件)',
                    '☰ 第 2 行 (2 个组件)',
                    '← 返回'
                ]);
            });
            expect(view.onLinesUpdate).toHaveBeenCalledTimes(1);
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([ONE_WIDGET, TWO_WIDGETS]);

            // Deleting the first line keeps the highlight on the first line
            view.press('d');
            await waitFor(() => {
                expect(view.frame()).toContain('☰ 第 1 行 (1 个组件)');
            });

            view.press(ENTER);
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '▶  ☰ 第 1 行 (2 个组件)',
                    '← 返回'
                ]);
            });
            expect(view.frame()).toContain(SINGLE_LINE_EDITING_HELP);
            expect(view.onLinesUpdate).toHaveBeenCalledTimes(2);
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([TWO_WIDGETS]);
            expect(view.onBack).not.toHaveBeenCalled();
            expect(view.onSelect).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('keeps the line when the delete is answered No or ESC, without going back', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY], allowEditing: true });
        const listRows = ['☰ 第 1 行 (1 个组件)', '▶  ☰ 第 2 行 (空)', '← 返回'];

        try {
            await waitFor(() => {
                expect(view.frame()).toContain(FULL_EDITING_HELP);
            });

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()).toEqual(listRows);
            });

            view.press('d');
            await waitFor(() => {
                expect(view.frame()).toMatch(/▶\s+是/);
            });

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.frame()).toMatch(/▶\s+否/);
            });

            view.press(ENTER);
            await waitFor(() => {
                expect(view.rows()).toEqual(listRows);
            });

            view.press('d');
            await waitFor(() => {
                expect(view.frame()).toContain('确定要删除此行吗？');
            });

            view.press(ESC);
            await waitFor(() => {
                expect(view.rows()).toEqual(listRows);
            });

            expect(view.onLinesUpdate).not.toHaveBeenCalled();
            expect(view.onBack).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('does not delete or move from the Back entry', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY], allowEditing: true });

        try {
            await waitFor(() => {
                expect(view.frame()).toContain(FULL_EDITING_HELP);
            });

            view.press(UP_ARROW);
            await waitFor(() => {
                expect(view.rows().at(-1)).toBe('▶  ← 返回');
            });

            await view.pressIgnored('d');
            await view.pressIgnored('m');
            expect(view.onLinesUpdate).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it('swaps the highlighted line with its neighbour in move mode, and with the far end past either edge', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY, TWO_WIDGETS], allowEditing: true });

        try {
            await waitFor(() => {
                expect(view.frame()).toContain(FULL_EDITING_HELP);
            });

            view.press('m');
            await waitFor(() => {
                expect(view.frame()).toContain('[移动模式]');
            });
            expect(view.frame()).toContain('↑↓ 移动行，ESC 或 Enter 退出移动模式');
            expect(view.rows()).toEqual([
                '◆  ☰ 第 1 行 (1 个组件)',
                '☰ 第 2 行 (空)',
                '☰ 第 3 行 (2 个组件)'
            ]);

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (空)',
                    '◆  ☰ 第 2 行 (1 个组件)',
                    '☰ 第 3 行 (2 个组件)'
                ]);
            });
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([EMPTY, ONE_WIDGET, TWO_WIDGETS]);

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()[2]).toBe('◆  ☰ 第 3 行 (1 个组件)');
            });
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([EMPTY, TWO_WIDGETS, ONE_WIDGET]);

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()[0]).toBe('◆  ☰ 第 1 行 (1 个组件)');
            });
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([ONE_WIDGET, TWO_WIDGETS, EMPTY]);

            view.press(UP_ARROW);
            await waitFor(() => {
                expect(view.rows()[2]).toBe('◆  ☰ 第 3 行 (1 个组件)');
            });
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([EMPTY, TWO_WIDGETS, ONE_WIDGET]);

            view.press(UP_ARROW);
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (空)',
                    '◆  ☰ 第 2 行 (1 个组件)',
                    '☰ 第 3 行 (2 个组件)'
                ]);
            });
            expect(view.onLinesUpdate).toHaveBeenLastCalledWith([EMPTY, ONE_WIDGET, TWO_WIDGETS]);
            expect(view.onLinesUpdate).toHaveBeenCalledTimes(5);

            // Move mode takes only the arrows, Enter and ESC
            await view.pressIgnored('a');
            expect(view.onLinesUpdate).toHaveBeenCalledTimes(5);
        } finally {
            view.cleanup();
        }
    });

    it('leaves move mode on Enter or ESC with the moved line still highlighted, without selecting or going back', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET, EMPTY], allowEditing: true });

        try {
            await waitFor(() => {
                expect(view.frame()).toContain(FULL_EDITING_HELP);
            });

            view.press('m');
            await waitFor(() => {
                expect(view.frame()).toContain('[移动模式]');
            });

            view.press(DOWN_ARROW);
            await waitFor(() => {
                expect(view.rows()[1]).toBe('◆  ☰ 第 2 行 (1 个组件)');
            });

            view.press(ENTER);
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (空)',
                    '▶  ☰ 第 2 行 (1 个组件)',
                    '← 返回'
                ]);
            });
            expect(view.frame()).not.toContain('[移动模式]');
            expect(view.frame()).toContain(FULL_EDITING_HELP);

            view.press('m');
            await waitFor(() => {
                expect(view.frame()).toContain('[移动模式]');
            });

            view.press(ESC);
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (空)',
                    '▶  ☰ 第 2 行 (1 个组件)',
                    '← 返回'
                ]);
            });

            expect(view.onSelect).not.toHaveBeenCalled();
            expect(view.onBack).not.toHaveBeenCalled();
            expect(view.onLinesUpdate).toHaveBeenCalledTimes(1);
        } finally {
            view.cleanup();
        }
    });

    it('shows a Powerline theme warning instead of the lines, and any key goes back', async () => {
        const view = renderLineSelector({
            lines: [ONE_WIDGET],
            blockIfPowerlineActive: true,
            settings: powerlineSettings(true, 'nord')
        });

        try {
            await waitFor(() => {
                expect(view.frame()).toContain('按任意键返回...');
            });
            const frame = view.frame();
            expect(frame.split('\n')[0]?.trim()).toBe('选择行');
            expect(frame).toContain('⚠ 颜色当前由 Powerline 主题管理： Nord');
            expect(frame).toContain('• 在 Powerline 配置 → 主题中切换到"自定义"主题');
            expect(frame).toContain('• 在 Powerline 配置中禁用 Powerline 模式');
            expect(view.rows()).toEqual([]);

            view.press('x');
            await waitFor(() => {
                expect(view.onBack).toHaveBeenCalledTimes(1);
            });
            expect(view.onSelect).not.toHaveBeenCalled();
        } finally {
            view.cleanup();
        }
    });

    it.each([
        { name: 'the Custom theme', block: true, settings: powerlineSettings(true, 'custom') },
        { name: 'Powerline off', block: true, settings: powerlineSettings(false, 'nord') },
        { name: 'no theme', block: true, settings: powerlineSettings(true, undefined) },
        { name: 'blocking not asked for', block: false, settings: powerlineSettings(true, 'nord') }
    ])('lists the lines with $name', async ({ block, settings }) => {
        const view = renderLineSelector({
            lines: [ONE_WIDGET],
            blockIfPowerlineActive: block,
            settings,
            title: '选择要编辑颜色的行'
        });

        try {
            await waitFor(() => {
                expect(view.rows()).toEqual(['▶  ☰ 第 1 行 (1 个组件)', '← 返回']);
            });
            expect(view.frame()).toContain('选择要编辑颜色的行');
            expect(view.frame()).not.toContain('由 Powerline 主题管理');
        } finally {
            view.cleanup();
        }
    });

    it('shows new lines and a new initial selection from its parent', async () => {
        const view = renderLineSelector({ lines: [ONE_WIDGET], initialSelection: 0 });

        try {
            await waitFor(() => {
                expect(view.rows()).toEqual(['▶  ☰ 第 1 行 (1 个组件)', '← 返回']);
            });

            view.rerender({ lines: [ONE_WIDGET, EMPTY, TWO_WIDGETS], initialSelection: 2 });
            await waitFor(() => {
                expect(view.rows()).toEqual([
                    '☰ 第 1 行 (1 个组件)',
                    '☰ 第 2 行 (空)',
                    '▶  ☰ 第 3 行 (2 个组件)',
                    '← 返回'
                ]);
            });

            view.press(ENTER);
            await waitFor(() => {
                expect(view.onSelect).toHaveBeenCalledWith(2);
            });
        } finally {
            view.cleanup();
        }
    });
});
