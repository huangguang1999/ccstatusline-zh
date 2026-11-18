import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'tinyglobby';

import type { BlockMetrics } from '../types';

import { getClaudeConfigDir } from './claude-settings';
import {
    JSONL_READ_CHUNK_BYTES,
    parseJsonlLine
} from './jsonl-lines';

const LOOKBACK_HOURS = [10, 20, 48] as const;
const MAX_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const TRANSCRIPT_CACHE_VERSION = 1;

export interface BlockScanOptions {
    /** Directory for resumable per-transcript timestamp caches. */
    cacheDir?: string;
    /** Stop reading at this epoch millisecond and save the current position. */
    deadlineMs?: number;
    /** Fixed reference time for all lookback windows in this scan. */
    nowMs?: number;
}

export type BlockScanResult = { status: 'complete'; metrics: BlockMetrics | null } | { status: 'timeout' };

interface TranscriptActivityCache {
    version: number;
    filePath: string;
    mtimeMs: number;
    size: number;
    offset: number;
    remainder: string;
    firstLine: boolean;
    complete: boolean;
    timestamps: number[];
}

interface TranscriptActivity {
    complete: boolean;
    timestamps: Set<number>;
}

interface TranscriptRow {
    timestamp?: string;
    isSidechain?: boolean;
    isApiErrorMessage?: boolean;
    message?: { usage?: { input_tokens?: number; output_tokens?: number } };
}

/**
 * Gets block metrics for the current 5-hour block from JSONL files.
 * Direct callers keep the original unbounded scan; the status-line cache uses
 * scanBlockMetrics with a deadline and resumable per-file caches.
 */
export function getBlockMetrics(): BlockMetrics | null {
    const claudeDir: string | null = getClaudeConfigDir();

    if (!claudeDir)
        return null;

    try {
        const result = scanBlockMetrics(claudeDir);
        return result.status === 'complete' ? result.metrics : null;
    } catch {
        return null;
    }
}

function isDeadlineExceeded(deadlineMs: number | undefined): boolean {
    return deadlineMs !== undefined && Date.now() >= deadlineMs;
}

function getTranscriptCachePath(cacheDir: string, filePath: string): string {
    const fileHash = createHash('sha256').update(filePath).digest('hex');
    return path.join(cacheDir, `${fileHash}.json`);
}

function readTranscriptCache(cacheDir: string | undefined, filePath: string): TranscriptActivityCache | null {
    if (!cacheDir) {
        return null;
    }

    try {
        const cache = JSON.parse(fs.readFileSync(getTranscriptCachePath(cacheDir, filePath), 'utf8')) as Partial<TranscriptActivityCache>;
        const validNumbers = [cache.mtimeMs, cache.size, cache.offset].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
        if (cache.version !== TRANSCRIPT_CACHE_VERSION
            || cache.filePath !== filePath
            || !validNumbers
            || typeof cache.remainder !== 'string'
            || typeof cache.firstLine !== 'boolean'
            || typeof cache.complete !== 'boolean'
            || !Array.isArray(cache.timestamps)
            || !cache.timestamps.every(timestamp => typeof timestamp === 'number' && Number.isFinite(timestamp))) {
            return null;
        }

        return cache as TranscriptActivityCache;
    } catch {
        return null;
    }
}

function writeTranscriptCache(cacheDir: string | undefined, filePath: string, cache: TranscriptActivityCache): void {
    if (!cacheDir) {
        return;
    }

    const cachePath = getTranscriptCachePath(cacheDir, filePath);
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    try {
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(temporaryPath, JSON.stringify(cache), 'utf8');
        fs.renameSync(temporaryPath, cachePath);
    } catch {
        // Caching is best-effort. A later render can reread the same bytes.
        try {
            fs.rmSync(temporaryPath, { force: true });
        } catch {
            // The temporary file was renamed or was never created.
        }
    }
}

function pruneTimestamps(timestamps: Set<number>, cutoffMs: number): void {
    for (const timestamp of timestamps) {
        if (timestamp < cutoffMs) {
            timestamps.delete(timestamp);
        }
    }
}

function addActivityLine(lineBytes: Buffer, firstLine: boolean, cutoffMs: number, timestamps: Set<number>): void {
    let line = lineBytes.toString('utf8');
    if (firstLine && line.charCodeAt(0) === 0xfeff) {
        line = line.slice(1);
    }
    if (line.endsWith('\r')) {
        line = line.slice(0, -1);
    }
    if (line.length === 0) {
        return;
    }

    const timestamp = getActivityTimestamp(parseJsonlLine(line) as TranscriptRow | null);
    if (timestamp && timestamp.getTime() >= cutoffMs) {
        timestamps.add(timestamp.getTime());
    }
}

function saveTranscriptProgress(
    cacheDir: string | undefined,
    filePath: string,
    stats: fs.Stats,
    offset: number,
    remainder: Buffer,
    firstLine: boolean,
    complete: boolean,
    timestamps: Set<number>
): void {
    writeTranscriptCache(cacheDir, filePath, {
        version: TRANSCRIPT_CACHE_VERSION,
        filePath,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        offset,
        remainder: remainder.toString('base64'),
        firstLine,
        complete,
        timestamps: Array.from(timestamps)
    });
}

/**
 * Reads only bytes not covered by a previous cache entry. JSONL transcripts are
 * append-only: a larger file resumes at the old offset, while a same-size file
 * whose mtime changed is rebuilt. A deadline returns a resumable partial entry
 * rather than pretending the file had no activity.
 */
function readTranscriptActivity(
    filePath: string,
    stats: fs.Stats,
    cutoffMs: number,
    cacheDir: string | undefined,
    deadlineMs: number | undefined
): TranscriptActivity {
    const cached = readTranscriptCache(cacheDir, filePath);
    if (cached?.complete && cached.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
        const timestamps = new Set(cached.timestamps);
        pruneTimestamps(timestamps, cutoffMs);
        return { complete: true, timestamps };
    }

    const canResume = cached !== null
        && stats.size >= cached.offset
        && (!cached.complete || stats.size > cached.size);
    const timestamps = new Set(canResume ? cached.timestamps : []);
    pruneTimestamps(timestamps, cutoffMs);
    let offset = canResume ? cached.offset : 0;
    let remainder = canResume ? Buffer.from(cached.remainder, 'base64') : Buffer.alloc(0);
    let firstLine = canResume ? cached.firstLine : true;

    if (isDeadlineExceeded(deadlineMs)) {
        if (cached) {
            saveTranscriptProgress(cacheDir, filePath, stats, offset, remainder, firstLine, false, timestamps);
        }
        return { complete: false, timestamps };
    }

    let descriptor: number;
    try {
        descriptor = fs.openSync(filePath, 'r');
    } catch {
        return { complete: false, timestamps };
    }

    try {
        const scratch = Buffer.allocUnsafe(JSONL_READ_CHUNK_BYTES);
        while (offset < stats.size) {
            const readSize = Math.min(scratch.length, stats.size - offset);
            const bytesRead = fs.readSync(descriptor, scratch, 0, readSize, offset);
            if (bytesRead === 0) {
                break;
            }
            offset += bytesRead;

            const newBytes = scratch.subarray(0, bytesRead);
            const data = remainder.length > 0 ? Buffer.concat([remainder, newBytes]) : newBytes;
            let lineStart = 0;
            let newline = data.indexOf(0x0a, lineStart);
            while (newline !== -1) {
                addActivityLine(data.subarray(lineStart, newline), firstLine, cutoffMs, timestamps);
                firstLine = false;
                lineStart = newline + 1;
                newline = data.indexOf(0x0a, lineStart);
            }
            remainder = Buffer.from(data.subarray(lineStart));

            if (isDeadlineExceeded(deadlineMs)) {
                saveTranscriptProgress(cacheDir, filePath, stats, offset, remainder, firstLine, false, timestamps);
                return { complete: false, timestamps };
            }
        }

        if (isDeadlineExceeded(deadlineMs)) {
            saveTranscriptProgress(cacheDir, filePath, stats, offset, remainder, firstLine, false, timestamps);
            return { complete: false, timestamps };
        }

        if (remainder.length > 0) {
            addActivityLine(remainder, firstLine, cutoffMs, timestamps);
            firstLine = false;
        }
        saveTranscriptProgress(cacheDir, filePath, stats, offset, remainder, firstLine, true, timestamps);
        return { complete: true, timestamps };
    } catch {
        saveTranscriptProgress(cacheDir, filePath, stats, offset, remainder, firstLine, false, timestamps);
        return { complete: false, timestamps };
    } finally {
        fs.closeSync(descriptor);
    }
}

/**
 * Finds the current block with optional time and persistent-cache bounds.
 * A timeout never returns a partial block as though it were authoritative.
 */
export function scanBlockMetrics(rootDir: string, options: BlockScanOptions = {}): BlockScanResult {
    const nowMs = options.nowMs ?? Date.now();
    const sessionDurationMs = 5 * 60 * 60 * 1000;
    const oldestCutoffMs = nowMs - MAX_LOOKBACK_MS;

    // Keep the pattern relative to cwd: inside a pattern, characters a directory
    // name can contain, such as ( ) [ ] { } * ?, are glob syntax.
    const files = globSync(['projects/**/*.jsonl'], {
        absolute: true,
        cwd: rootDir,
        // Artifacts under a project may link to a frontend repository's
        // node_modules. Following those links leaves the transcript tree and
        // can enumerate an entire dependency repository on every repaint.
        followSymbolicLinks: false
    });
    if (files.length === 0) {
        return { status: 'complete', metrics: null };
    }

    const filesWithStats = files.map(file => ({ file, stats: fs.statSync(file) }));
    filesWithStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    let timestamps: Date[] = [];
    let mostRecentTimestamp: Date | null = null;
    let continuousWorkStart: Date | null = null;
    let foundSessionGap = false;

    // Preserve the progressive lookback: unchanged transcripts answer from
    // their caches when a later chunk needs them again.
    for (const lookbackHours of LOOKBACK_HOURS) {
        const cutoffMs = nowMs - lookbackHours * 60 * 60 * 1000;
        timestamps = [];

        for (const { file, stats } of filesWithStats) {
            if (stats.mtimeMs < cutoffMs) {
                break;
            }
            const activity = readTranscriptActivity(file, stats, oldestCutoffMs, options.cacheDir, options.deadlineMs);
            if (!activity.complete) {
                return { status: 'timeout' };
            }
            for (const timestamp of activity.timestamps) {
                if (timestamp >= cutoffMs) {
                    timestamps.push(new Date(timestamp));
                }
            }
        }

        if (timestamps.length === 0) {
            continue;
        }

        timestamps.sort((a, b) => b.getTime() - a.getTime());
        if (!mostRecentTimestamp && timestamps[0]) {
            mostRecentTimestamp = timestamps[0];
            if (nowMs - mostRecentTimestamp.getTime() > sessionDurationMs) {
                return { status: 'complete', metrics: null };
            }
        }

        const isLastChunk = lookbackHours === LOOKBACK_HOURS[LOOKBACK_HOURS.length - 1];
        continuousWorkStart = mostRecentTimestamp;
        for (let index = 1; index < timestamps.length; index++) {
            const currentTimestamp = timestamps[index];
            const previousTimestamp = timestamps[index - 1];
            if (!currentTimestamp || !previousTimestamp) {
                continue;
            }

            const gap = previousTimestamp.getTime() - currentTimestamp.getTime();
            if (gap >= sessionDurationMs) {
                foundSessionGap = isLastChunk
                    || previousTimestamp.getTime() - cutoffMs >= sessionDurationMs;
                break;
            }
            continuousWorkStart = currentTimestamp;
        }

        if (foundSessionGap || isLastChunk) {
            break;
        }
    }

    if (!mostRecentTimestamp || !continuousWorkStart) {
        return { status: 'complete', metrics: null };
    }

    const blocks: { start: Date; end: Date }[] = [];
    const sortedTimestamps = timestamps.slice().sort((a, b) => a.getTime() - b.getTime());
    let currentBlockStart: Date | null = null;
    let currentBlockEnd: Date | null = null;

    for (const timestamp of sortedTimestamps) {
        if (timestamp.getTime() < continuousWorkStart.getTime()) {
            continue;
        }
        if (!currentBlockStart || (currentBlockEnd && timestamp.getTime() > currentBlockEnd.getTime())) {
            currentBlockStart = floorToHour(timestamp);
            currentBlockEnd = new Date(currentBlockStart.getTime() + sessionDurationMs);
            blocks.push({ start: currentBlockStart, end: currentBlockEnd });
        }
    }

    for (const block of blocks) {
        if (nowMs >= block.start.getTime() && nowMs <= block.end.getTime()) {
            const hasActivity = timestamps.some(timestamp => timestamp.getTime() >= block.start.getTime()
                && timestamp.getTime() <= block.end.getTime());
            if (hasActivity) {
                return {
                    status: 'complete',
                    metrics: {
                        startTime: block.start,
                        lastActivity: mostRecentTimestamp
                    }
                };
            }
        }
    }

    return { status: 'complete', metrics: null };
}

/** Gets when a transcript row was served, or null when the row isn't block activity. */
function getActivityTimestamp(json: TranscriptRow | null): Date | null {
    const usage = json?.message?.usage;
    if (!usage) {
        return null;
    }

    const hasInputTokens = typeof usage.input_tokens === 'number';
    const hasOutputTokens = typeof usage.output_tokens === 'number';
    if (!hasInputTokens || !hasOutputTokens) {
        return null;
    }
    if (json.isSidechain === true || json.isApiErrorMessage === true) {
        return null;
    }

    const timestamp = json.timestamp;
    if (typeof timestamp !== 'string') {
        return null;
    }
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Floors a timestamp to the beginning of the hour (matching existing logic). */
function floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
}
