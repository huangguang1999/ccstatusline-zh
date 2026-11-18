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
const TRANSCRIPT_CACHE_VERSION = 2;
const SCAN_STATE_VERSION = 1;
const SCAN_STATE_MAX_AGE_MS = 15 * 60 * 1000;
const SCAN_STATE_FILE = 'scan-state.json';

export interface BlockScanOptions {
    /** Directory for resumable discovery, per-transcript activity and progress. */
    cacheDir?: string;
    /** Stop after the current chunk once this epoch millisecond is reached. */
    deadlineMs?: number;
    /** Fixed reference time for all lookback windows in this scan. */
    nowMs?: number;
}

export type BlockScanResult = { status: 'complete'; metrics: BlockMetrics | null } | { status: 'timeout' };

interface TranscriptFileStat {
    file: string;
    mtimeMs: number;
    size: number;
}

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

interface BlockScanState {
    version: number;
    rootDir: string;
    nowMs: number;
    nextFileIndex: number;
    files: TranscriptFileStat[];
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

/** Gets block metrics with the original complete, unbounded scan. */
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

function writeJsonAtomic(cachePath: string, value: unknown): void {
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    try {
        const serialized = JSON.stringify(value);
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.writeFileSync(temporaryPath, serialized, 'utf8');
        fs.renameSync(temporaryPath, cachePath);
    } catch {
        try {
            fs.rmSync(temporaryPath, { force: true });
        } catch {
            // The temporary file was renamed or was never created.
        }
    }
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
    if (cacheDir) {
        writeJsonAtomic(getTranscriptCachePath(cacheDir, filePath), cache);
    }
}

function getScanStatePath(cacheDir: string): string {
    return path.join(cacheDir, SCAN_STATE_FILE);
}

function readScanState(cacheDir: string | undefined, rootDir: string): BlockScanState | null {
    if (!cacheDir) {
        return null;
    }

    try {
        const state = JSON.parse(fs.readFileSync(getScanStatePath(cacheDir), 'utf8')) as Partial<BlockScanState>;
        const validFiles = Array.isArray(state.files) && state.files.every(file => (
            typeof file.file === 'string'
            && typeof file.mtimeMs === 'number' && Number.isFinite(file.mtimeMs) && file.mtimeMs >= 0
            && typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0
        ));
        if (state.version !== SCAN_STATE_VERSION
            || state.rootDir !== rootDir
            || typeof state.nowMs !== 'number' || !Number.isFinite(state.nowMs)
            || typeof state.nextFileIndex !== 'number'
            || !Number.isInteger(state.nextFileIndex)
            || state.nextFileIndex < 0
            || !validFiles
            || !state.files
            || state.nextFileIndex > state.files.length) {
            return null;
        }
        return state as BlockScanState;
    } catch {
        return null;
    }
}

function writeScanState(cacheDir: string | undefined, state: BlockScanState): void {
    if (cacheDir) {
        writeJsonAtomic(getScanStatePath(cacheDir), state);
    }
}

function removeScanState(cacheDir: string | undefined): void {
    if (!cacheDir) {
        return;
    }
    try {
        fs.rmSync(getScanStatePath(cacheDir), { force: true });
    } catch {
        // A later scan can discard or overwrite an abandoned state.
    }
}

function discoverTranscriptFiles(rootDir: string, nowMs: number): TranscriptFileStat[] {
    // Artifacts under a project may link to a frontend repository's
    // node_modules. Following those links leaves the transcript tree.
    const files = globSync(['projects/**/*.jsonl'], {
        absolute: true,
        cwd: rootDir,
        followSymbolicLinks: false
    });
    const oldestMtimeMs = nowMs - MAX_LOOKBACK_MS;
    return files
        .map((file): TranscriptFileStat => {
            const stats = fs.statSync(file);
            return { file, mtimeMs: stats.mtimeMs, size: stats.size };
        })
        .filter(file => file.mtimeMs >= oldestMtimeMs)
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function addActivityLine(lineBytes: Buffer, firstLine: boolean, timestamps: Set<number>): void {
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
    if (timestamp) {
        timestamps.add(timestamp.getTime());
    }
}

function saveTranscriptProgress(
    cacheDir: string | undefined,
    file: TranscriptFileStat,
    offset: number,
    remainder: Buffer,
    firstLine: boolean,
    complete: boolean,
    timestamps: Set<number>
): void {
    writeTranscriptCache(cacheDir, file.file, {
        version: TRANSCRIPT_CACHE_VERSION,
        filePath: file.file,
        mtimeMs: file.mtimeMs,
        size: file.size,
        offset,
        remainder: remainder.toString('base64'),
        firstLine,
        complete,
        // The legacy algorithm uses every activity row in an mtime-eligible
        // file, including rows older than the lookback. Deduplication only
        // removes zero-length gaps and does not change the block chain.
        timestamps: Array.from(timestamps)
    });
}

/** Reads at least one chunk, then stops at a chunk boundary after the deadline. */
function readTranscriptActivity(
    file: TranscriptFileStat,
    cacheDir: string | undefined,
    deadlineMs: number | undefined
): TranscriptActivity {
    const cached = readTranscriptCache(cacheDir, file.file);
    if (cached?.complete && cached.size === file.size && cached.mtimeMs === file.mtimeMs) {
        return { complete: true, timestamps: new Set(cached.timestamps) };
    }

    const canResume = cached !== null
        && file.size >= cached.offset
        && (!cached.complete || file.size > cached.size);
    const timestamps = new Set(canResume ? cached.timestamps : []);
    let offset = canResume ? cached.offset : 0;
    let remainder = canResume ? Buffer.from(cached.remainder, 'base64') : Buffer.alloc(0);
    let firstLine = canResume ? cached.firstLine : true;

    let descriptor: number;
    try {
        descriptor = fs.openSync(file.file, 'r');
    } catch {
        // The old iterator returned no activity for an unreadable file.
        return { complete: true, timestamps: new Set() };
    }

    try {
        const scratch = Buffer.allocUnsafe(JSONL_READ_CHUNK_BYTES);
        while (offset < file.size) {
            const readSize = Math.min(scratch.length, file.size - offset);
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
                addActivityLine(data.subarray(lineStart, newline), firstLine, timestamps);
                firstLine = false;
                lineStart = newline + 1;
                newline = data.indexOf(0x0a, lineStart);
            }
            remainder = Buffer.from(data.subarray(lineStart));

            // Do not leave a zero-progress round even when discovery used the
            // whole budget. At EOF, finish the file rather than repeatedly
            // saving an offset that cannot advance.
            if (offset < file.size && isDeadlineExceeded(deadlineMs)) {
                saveTranscriptProgress(cacheDir, file, offset, remainder, firstLine, false, timestamps);
                return { complete: false, timestamps };
            }
        }

        if (remainder.length > 0) {
            addActivityLine(remainder, firstLine, timestamps);
            firstLine = false;
        }
        saveTranscriptProgress(cacheDir, file, offset, remainder, firstLine, true, timestamps);
        return { complete: true, timestamps };
    } catch {
        // getAllTimestampsFromFile historically discarded this file's rows on
        // a read failure. Keep that result while leaving any resumable cache.
        return { complete: true, timestamps: new Set() };
    } finally {
        try {
            fs.closeSync(descriptor);
        } catch {
            // Match the best-effort read path.
        }
    }
}

function isReusableScanState(state: BlockScanState | null, requestedNowMs: number): state is BlockScanState {
    return state !== null
        && requestedNowMs >= state.nowMs
        && requestedNowMs - state.nowMs <= SCAN_STATE_MAX_AGE_MS;
}

/** Computes the legacy progressive-lookback result from already-read files. */
function calculateBlockMetrics(
    files: TranscriptFileStat[],
    activities: ReadonlyMap<string, Set<number>>,
    nowMs: number
): BlockMetrics | null {
    const sessionDurationMs = 5 * 60 * 60 * 1000;
    let timestamps: Date[] = [];
    let mostRecentTimestamp: Date | null = null;
    let continuousWorkStart: Date | null = null;
    let foundSessionGap = false;

    for (const lookbackHours of LOOKBACK_HOURS) {
        const cutoffMs = nowMs - lookbackHours * 60 * 60 * 1000;
        timestamps = [];
        for (const file of files) {
            if (file.mtimeMs < cutoffMs) {
                break;
            }
            // Deliberately no timestamp cutoff: this is the legacy behavior.
            for (const timestamp of activities.get(file.file) ?? []) {
                timestamps.push(new Date(timestamp));
            }
        }

        if (timestamps.length === 0) {
            continue;
        }
        timestamps.sort((a, b) => b.getTime() - a.getTime());
        if (!mostRecentTimestamp && timestamps[0]) {
            mostRecentTimestamp = timestamps[0];
            if (nowMs - mostRecentTimestamp.getTime() > sessionDurationMs) {
                return null;
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
                foundSessionGap = isLastChunk || previousTimestamp.getTime() - cutoffMs >= sessionDurationMs;
                break;
            }
            continuousWorkStart = currentTimestamp;
        }
        if (foundSessionGap || isLastChunk) {
            break;
        }
    }

    if (!mostRecentTimestamp || !continuousWorkStart) {
        return null;
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
                return { startTime: block.start, lastActivity: mostRecentTimestamp };
            }
        }
    }
    return null;
}

/**
 * Scans each eligible transcript once. A persisted session reuses discovery and
 * completed-file positions across repaints; caches are parsed only when their
 * file is read or when the final calculation needs an earlier file.
 */
export function scanBlockMetrics(rootDir: string, options: BlockScanOptions = {}): BlockScanResult {
    const requestedNowMs = options.nowMs ?? Date.now();
    let state = readScanState(options.cacheDir, rootDir);
    if (!isReusableScanState(state, requestedNowMs)) {
        state = {
            version: SCAN_STATE_VERSION,
            rootDir,
            nowMs: requestedNowMs,
            nextFileIndex: 0,
            files: discoverTranscriptFiles(rootDir, requestedNowMs)
        };
        writeScanState(options.cacheDir, state);
    }

    const scanState = state;
    if (scanState.files.length === 0) {
        removeScanState(options.cacheDir);
        return { status: 'complete', metrics: null };
    }

    const activities = new Map<string, Set<number>>();
    while (scanState.nextFileIndex < scanState.files.length) {
        const file = scanState.files[scanState.nextFileIndex];
        if (!file) {
            break;
        }
        const activity = readTranscriptActivity(file, options.cacheDir, options.deadlineMs);
        if (!activity.complete) {
            writeScanState(options.cacheDir, scanState);
            return { status: 'timeout' };
        }
        activities.set(file.file, activity.timestamps);
        scanState.nextFileIndex += 1;
        if (isDeadlineExceeded(options.deadlineMs)) {
            writeScanState(options.cacheDir, scanState);
            return { status: 'timeout' };
        }
    }
    writeScanState(options.cacheDir, scanState);

    // Earlier rounds did not retain their parsed caches in this process. Read
    // each once now; files handled by this round already answer from memory.
    for (const file of scanState.files) {
        if (activities.has(file.file)) {
            continue;
        }
        const cached = readTranscriptCache(options.cacheDir, file.file);
        if (cached?.complete && cached.size === file.size && cached.mtimeMs === file.mtimeMs) {
            activities.set(file.file, new Set(cached.timestamps));
            continue;
        }
        const activity = readTranscriptActivity(file, options.cacheDir, undefined);
        activities.set(file.file, activity.timestamps);
    }

    const metrics = calculateBlockMetrics(scanState.files, activities, scanState.nowMs);
    removeScanState(options.cacheDir);
    return { status: 'complete', metrics };
}

/** Gets when a transcript row was served, or null when the row isn't block activity. */
function getActivityTimestamp(json: TranscriptRow | null): Date | null {
    const usage = json?.message?.usage;
    if (!usage) {
        return null;
    }
    if (typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') {
        return null;
    }
    if (json.isSidechain === true || json.isApiErrorMessage === true) {
        return null;
    }
    if (typeof json.timestamp !== 'string') {
        return null;
    }
    const date = new Date(json.timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Floors a timestamp to the beginning of the hour (matching existing logic). */
function floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
}
