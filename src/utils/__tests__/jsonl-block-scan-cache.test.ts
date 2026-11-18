import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock
} from 'vitest';

import { scanBlockMetrics } from '../jsonl-blocks';
import {
    getBlockCachePath,
    getCachedBlockMetrics,
    writeBlockCache
} from '../jsonl-cache';

function makeUsageLine(timestamp: Date): string {
    return JSON.stringify({
        timestamp: timestamp.toISOString(),
        message: { usage: { input_tokens: 100, output_tokens: 50 } }
    });
}

function floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
}

type ReadSync = (descriptor: number, buffer: Buffer, offset: number, length: number, position: number | null) => number;

function spyOnReadSync(): Mock<ReadSync> {
    return vi.spyOn(fs, 'readSync') as unknown as Mock<ReadSync>;
}

describe('resumable transcript block scans', () => {
    let tempDir: string;
    let claudeDir: string;
    let cacheDir: string;
    let transcriptPath: string;
    let originalClaudeConfigDir: string | undefined;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccstatusline-block-resume-'));
        claudeDir = path.join(tempDir, '.claude');
        cacheDir = path.join(tempDir, 'block-files');
        const projectDir = path.join(claudeDir, 'projects', 'project-a');
        fs.mkdirSync(projectDir, { recursive: true });
        transcriptPath = path.join(projectDir, 'session.jsonl');
        originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
        process.env.CLAUDE_CONFIG_DIR = claudeDir;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalClaudeConfigDir === undefined) {
            delete process.env.CLAUDE_CONFIG_DIR;
        } else {
            process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it.skipIf(process.platform === 'win32')('does not follow artifact symlinks into dependency trees', () => {
        const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
        const transcriptActivity = new Date(nowMs - 30 * 60 * 1000);
        const linkedActivity = new Date(nowMs - 5 * 60 * 1000);
        fs.writeFileSync(transcriptPath, makeUsageLine(transcriptActivity));

        const linkedRepository = path.join(tempDir, 'linked-node_modules');
        fs.mkdirSync(linkedRepository);
        fs.writeFileSync(path.join(linkedRepository, 'dependency.jsonl'), makeUsageLine(linkedActivity));
        fs.symlinkSync(linkedRepository, path.join(path.dirname(transcriptPath), 'node_modules'), 'dir');

        const result = scanBlockMetrics(claudeDir, { cacheDir, nowMs });
        expect(result.status).toBe('complete');
        if (result.status === 'complete') {
            expect(result.metrics?.lastActivity.toISOString()).toBe(transcriptActivity.toISOString());
        }
    });

    it('keeps timestamps older than the lookback in recently modified transcripts', () => {
        const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
        const rows: string[] = [];
        // Four-hour gaps form one continuous chain for 60 hours. The legacy
        // algorithm reads every row in this recently modified file, including
        // rows before its 10/20/48-hour file-mtime lookback.
        for (let hoursAgo = 60; hoursAgo >= 0; hoursAgo -= 4) {
            rows.push(makeUsageLine(new Date(nowMs - hoursAgo * 60 * 60 * 1000)));
        }
        fs.writeFileSync(transcriptPath, rows.join('\n'));
        fs.utimesSync(transcriptPath, nowMs / 1000, nowMs / 1000);

        const result = scanBlockMetrics(claudeDir, { cacheDir, nowMs });
        expect(result.status).toBe('complete');
        if (result.status === 'complete') {
            expect(result.metrics?.startTime.toISOString()).toBe('2026-11-18T08:00:00.000Z');
            expect(result.metrics?.lastActivity.toISOString()).toBe('2026-11-18T12:00:00.000Z');
        }
    });

    it('saves a mid-file timeout and resumes from its byte offset', () => {
        const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
        const recentActivity = new Date(nowMs - 30 * 60 * 1000);
        // Larger than one read chunk, so the injected clock expiry interrupts
        // the first file rather than letting the scan finish in one pass.
        fs.writeFileSync(transcriptPath, `${makeUsageLine(recentActivity)}\n`.repeat(15_000));

        let clockMs = 0;
        vi.spyOn(Date, 'now').mockImplementation(() => clockMs);
        const originalReadSync = fs.readSync;
        spyOnReadSync().mockImplementation((descriptor, buffer, offset, length, position) => {
            const bytesRead = originalReadSync(descriptor, buffer, offset, length, position);
            clockMs = 1000;
            return bytesRead;
        });

        const interrupted = scanBlockMetrics(claudeDir, { cacheDir, deadlineMs: 1000, nowMs });
        expect(interrupted).toEqual({ status: 'timeout' });

        const cacheFiles = fs.readdirSync(cacheDir).filter(file => file.endsWith('.json') && file !== 'scan-state.json');
        expect(cacheFiles).toHaveLength(1);
        expect(fs.existsSync(path.join(cacheDir, 'scan-state.json'))).toBe(true);
        const partial = JSON.parse(fs.readFileSync(path.join(cacheDir, cacheFiles[0] ?? ''), 'utf8')) as { complete: boolean; offset: number };
        expect(partial.complete).toBe(false);
        expect(partial.offset).toBeGreaterThan(0);
        expect(partial.offset).toBeLessThan(fs.statSync(transcriptPath).size);

        vi.restoreAllMocks();
        const statSync = vi.spyOn(fs, 'statSync');
        const resumed = scanBlockMetrics(claudeDir, { cacheDir, nowMs });
        // The persisted discovery snapshot avoids another glob/stat pass.
        expect(statSync).not.toHaveBeenCalled();
        statSync.mockRestore();
        expect(resumed.status).toBe('complete');
        if (resumed.status === 'complete') {
            expect(resumed.metrics?.startTime.toISOString()).toBe(floorToHour(recentActivity).toISOString());
            expect(resumed.metrics?.lastActivity.toISOString()).toBe(recentActivity.toISOString());
        }

        const completed = JSON.parse(fs.readFileSync(path.join(cacheDir, cacheFiles[0] ?? ''), 'utf8')) as { complete: boolean; offset: number };
        expect(completed.complete).toBe(true);
        expect(completed.offset).toBe(fs.statSync(transcriptPath).size);
    });

    it('reuses unchanged transcript caches when the block cache expires', () => {
        vi.spyOn(os, 'homedir').mockReturnValue(path.join(tempDir, 'home'));
        const now = new Date();
        const recentActivity = new Date(now.getTime() - 30 * 60 * 1000);
        fs.writeFileSync(transcriptPath, makeUsageLine(recentActivity));

        const first = getCachedBlockMetrics();
        expect(first?.startTime.toISOString()).toBe(floorToHour(recentActivity).toISOString());

        // Force only the aggregate block cache to expire. The per-file cache
        // still proves the transcript's contents have not changed.
        writeBlockCache(new Date(now.getTime() - 6 * 60 * 60 * 1000));
        const readSync = spyOnReadSync();
        const recalculated = getCachedBlockMetrics();

        expect(recalculated?.startTime.toISOString()).toBe(floorToHour(recentActivity).toISOString());
        expect(readSync).not.toHaveBeenCalled();
    });

    it('reads only appended bytes after a transcript grows', () => {
        const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
        const firstActivity = new Date(nowMs - 2 * 60 * 60 * 1000);
        const appendedActivity = new Date(nowMs - 30 * 60 * 1000);
        fs.writeFileSync(transcriptPath, makeUsageLine(firstActivity));
        expect(scanBlockMetrics(claudeDir, { cacheDir, nowMs }).status).toBe('complete');
        const originalSize = fs.statSync(transcriptPath).size;

        fs.appendFileSync(transcriptPath, `\n${makeUsageLine(appendedActivity)}`);
        const readSync = spyOnReadSync();
        const appended = scanBlockMetrics(claudeDir, { cacheDir, nowMs });

        expect(readSync).toHaveBeenCalledTimes(1);
        expect(readSync.mock.calls[0]?.[4]).toBe(originalSize);
        expect(appended.status).toBe('complete');
        if (appended.status === 'complete') {
            expect(appended.metrics?.startTime.toISOString()).toBe(floorToHour(firstActivity).toISOString());
            expect(appended.metrics?.lastActivity.toISOString()).toBe(appendedActivity.toISOString());
        }
    });

    it('reads a chunk even when discovery has already exhausted the budget', () => {
        const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
        fs.writeFileSync(transcriptPath, `${makeUsageLine(new Date(nowMs))}\n`.repeat(15_000));

        const result = scanBlockMetrics(claudeDir, { cacheDir, deadlineMs: Date.now() - 1, nowMs });
        expect(result).toEqual({ status: 'timeout' });

        const cacheFiles = fs.readdirSync(cacheDir).filter(file => file.endsWith('.json') && file !== 'scan-state.json');
        expect(cacheFiles).toHaveLength(1);
        const partial = JSON.parse(fs.readFileSync(path.join(cacheDir, cacheFiles[0] ?? ''), 'utf8')) as { complete: boolean; offset: number };
        expect(partial.complete).toBe(false);
        expect(partial.offset).toBeGreaterThan(0);
    });

    it('does not turn a timed-out public scan into a no-block cache entry', () => {
        vi.spyOn(os, 'homedir').mockReturnValue(path.join(tempDir, 'home'));
        fs.writeFileSync(transcriptPath, makeUsageLine(new Date()));

        expect(getCachedBlockMetrics(5, 0)).toBeNull();
        expect(fs.existsSync(getBlockCachePath())).toBe(false);
        // Another widget in this same render shares the expired deadline and
        // returns immediately instead of starting a second scan.
        expect(getCachedBlockMetrics()).toBeNull();
        expect(fs.existsSync(getBlockCachePath())).toBe(false);
    });
});
