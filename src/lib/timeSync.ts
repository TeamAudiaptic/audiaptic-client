/**
 * Clock synchronization against the DAVHI server.
 *
 * The algorithm is specified in the Time Synchronization spike:
 * https://teamaudiaptic.github.io/audiaptic-docs/docs/spikes/time-sync
 *
 * This is a TypeScript port of the Max connection patch's timeSync.js. Keep
 * the logic identical to that file (only RESYNC_INTERVAL_MS differs): the spike specifies one algorithm for
 * both, and the shared vectors in timeSync.vectors.json check both against it.
 * App-specific wiring (the server request, when to re-sync) lives in
 * clientTimeSync.ts, not here.
 *
 * Clocks:
 * - wall: Date.now(), epoch ms; the OS or user can change it.
 * - monotonic: performance.now(), ms since process start; never stepped.
 * - server: the DAVHI server's epoch ms.
 *
 * Offsets (server minus the named clock):
 * - monotonicOffset: stored per sync; serverNow() is built on it, so an OS
 *   clock change can't move server time.
 * - wallOffset: derived on demand; converts wall-clock epoch times.
 */

export const SAMPLES_PER_BURST = 6;
const MAX_CONSECUTIVE_FAILURES = 2;
// The client re-syncs every 5 s; Max and the spike use 60 s. This is the one
// intended difference from timeSync.js.
export const RESYNC_INTERVAL_MS = 5000;
export const RETRY_INTERVAL_MS = 10000;
export const MAX_OFFSET_AGE_MS = 5 * 60000;
const ACCEPT_ERROR_FACTOR = 2;
export const CLOCK_CHECK_INTERVAL_MS = 5000;
export const CLOCK_STEP_THRESHOLD_MS = 5;

export interface Sample {
  monotonicOffset: number;
  delay: number;
  error: number;
}

export interface SyncStatus {
  synced: boolean;
  /** Add to a wall-clock epoch time to get server time; 0 until synced. */
  wallOffset: number;
  /** Worst-case error of the current offset (ms); 0 until synced. */
  error: number;
  /** Ms since the current offset was measured; 0 until synced. */
  age: number;
}

export interface SyncResult {
  /** Whether this burst replaced the offset. */
  accepted: boolean;
  /** Why the burst failed, or null (including when a good result was not needed). */
  reason: string | null;
  status: SyncStatus;
}

type Outcome = Omit<SyncResult, "status">;

interface CurrentOffset {
  monotonicOffset: number;
  error: number;
  /** Monotonic clock when the offset was accepted. */
  syncedAt: number;
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface TimeSyncOptions {
  /** Resolves with the server's epoch milliseconds; rejects on failure or timeout. */
  fetchServerTime: () => Promise<number>;
  /** Monotonic milliseconds. */
  monotonicNow: () => number;
  /** Wall-clock epoch milliseconds. */
  wallNow: () => number;
  /** Called after every burst. */
  onResult?: (result: SyncResult) => void;
  setTimeout?: (callback: () => void, ms: number) => TimerHandle;
  clearTimeout?: (timer: TimerHandle | null) => void;
}

/**
 * Cristian's algorithm for one request.
 *
 * @param t1 Monotonic clock just before the request was sent.
 * @param serverTimestamp Server clock when it handled the request.
 * @param t4 Monotonic clock when the response arrived.
 */
export function computeSample(t1: number, serverTimestamp: number, t4: number): Sample {
  const delay = t4 - t1;
  return {
    monotonicOffset: serverTimestamp - (t1 + t4) / 2,
    delay,
    error: delay / 2,
  };
}

/**
 * Picks the sample to keep from one burst: the first request is discarded as
 * connection warm-up, failed requests (null) are discarded, and the remaining
 * sample with the lowest delay wins.
 *
 * @param samples Samples in the order they were taken.
 * @returns The best sample, or null if none are usable.
 */
export function selectBestSample(samples: (Sample | null)[]): Sample | null {
  let best: Sample | null = null;
  for (const sample of samples.slice(1)) {
    if (sample !== null && (best === null || sample.delay < best.delay)) {
      best = sample;
    }
  }
  return best;
}

/**
 * Decides whether a new burst result replaces the current offset, so a burst
 * made under poor network conditions does not replace a good offset.
 *
 * @param now Monotonic clock, like current.syncedAt.
 */
export function shouldAccept(
  current: { error: number; syncedAt: number } | null,
  candidate: { error: number },
  now: number,
): boolean {
  if (current === null) {
    return true;
  }
  if (candidate.error <= current.error * ACCEPT_ERROR_FACTOR) {
    return true;
  }
  return now - current.syncedAt > MAX_OFFSET_AGE_MS;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Creates the controller that keeps an offset fresh. */
export function createTimeSync(options: TimeSyncOptions) {
  const { fetchServerTime, monotonicNow, wallNow } = options;
  const onResult = options.onResult || (() => {});
  const startTimer = options.setTimeout || ((callback, ms) => setTimeout(callback, ms));
  const cancelTimer =
    options.clearTimeout ||
    ((timer) => {
      if (timer !== null) clearTimeout(timer);
    });

  // Null until synced.
  let current: CurrentOffset | null = null;
  let forceNext = false;
  let running = false;
  let inFlight: Promise<SyncResult> | null = null;
  let resyncTimer: TimerHandle | null = null;
  let clockCheckTimer: TimerHandle | null = null;
  let lastCheck: { wall: number; monotonic: number } | null = null;

  function isSynced(): boolean {
    return current !== null;
  }

  /**
   * Current time on the server's clock (epoch ms).
   * - Offset already applied.
   * - Wall clock until the first sync.
   */
  function serverNow(): number {
    return current === null ? wallNow() : monotonicNow() + current.monotonicOffset;
  }

  /**
   * Add to a wall-clock epoch time to get server time; 0 until synced.
   * Derived each call so it follows wall-clock changes.
   */
  function wallOffset(): number {
    return serverNow() - wallNow();
  }

  function status(): SyncStatus {
    if (current === null) {
      return { synced: false, wallOffset: 0, error: 0, age: 0 };
    }
    return {
      synced: true,
      wallOffset: wallOffset(),
      error: current.error,
      age: monotonicNow() - current.syncedAt,
    };
  }

  async function takeSample(): Promise<Sample> {
    const t1 = monotonicNow();
    const serverTimestamp = await fetchServerTime();
    const t4 = monotonicNow();
    return computeSample(t1, serverTimestamp, t4);
  }

  async function burst(): Promise<Outcome> {
    const samples: (Sample | null)[] = [];
    let consecutiveFailures = 0;
    let lastFailure = "no usable samples";

    while (samples.length < SAMPLES_PER_BURST && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      try {
        samples.push(await takeSample());
        consecutiveFailures = 0;
      } catch (error) {
        samples.push(null);
        consecutiveFailures += 1;
        lastFailure = messageOf(error);
      }
    }

    const best = selectBestSample(samples);
    if (best === null) {
      return { accepted: false, reason: `Clock sync failed: ${lastFailure}` };
    }

    const now = monotonicNow();
    if (!forceNext && !shouldAccept(current, best, now)) {
      return { accepted: false, reason: null };
    }

    current = { monotonicOffset: best.monotonicOffset, error: best.error, syncedAt: now };
    forceNext = false;
    return { accepted: true, reason: null };
  }

  function scheduleResync(delayMs: number) {
    cancelTimer(resyncTimer);
    resyncTimer = running
      ? startTimer(() => {
          syncNow();
        }, delayMs)
      : null;
  }

  /**
   * Runs one burst. Calls made while a burst is in flight share its result.
   * Never rejects.
   */
  function syncNow(): Promise<SyncResult> {
    if (inFlight !== null) {
      return inFlight;
    }

    cancelTimer(resyncTimer);
    resyncTimer = null;
    inFlight = burst()
      .catch((error): Outcome => ({
        accepted: false,
        reason: `Clock sync failed: ${messageOf(error)}`,
      }))
      .then((outcome) => {
        inFlight = null;
        scheduleResync(outcome.accepted ? RESYNC_INTERVAL_MS : RETRY_INTERVAL_MS);
        const result = { ...outcome, status: status() };
        onResult(result);
        return result;
      });
    return inFlight;
  }

  /**
   * The wall clock and the monotonic clock should advance together. If they
   * do not, either the OS changed the wall clock or the machine slept and
   * the monotonic clock paused; the next burst is accepted unconditionally.
   */
  function checkClocks() {
    const check = { wall: wallNow(), monotonic: monotonicNow() };
    const previous = lastCheck;
    lastCheck = check;
    if (previous === null) {
      return;
    }

    const divergence = check.wall - previous.wall - (check.monotonic - previous.monotonic);
    if (Math.abs(divergence) > CLOCK_STEP_THRESHOLD_MS) {
      forceNext = true;
      syncNow();
    }
  }

  function scheduleClockCheck() {
    clockCheckTimer = startTimer(() => {
      if (!running) {
        return;
      }
      checkClocks();
      scheduleClockCheck();
    }, CLOCK_CHECK_INTERVAL_MS);
  }

  /** Runs a burst now and keeps the offset fresh until stop() is called. */
  function start(): Promise<SyncResult> {
    if (!running) {
      running = true;
      lastCheck = null;
      checkClocks();
      scheduleClockCheck();
    }
    return syncNow();
  }

  /** Stops the timers. The last offset is kept and still applied. */
  function stop() {
    running = false;
    cancelTimer(resyncTimer);
    cancelTimer(clockCheckTimer);
    resyncTimer = null;
    clockCheckTimer = null;
  }

  return { start, stop, syncNow, serverNow, wallOffset, isSynced, status };
}

export type TimeSync = ReturnType<typeof createTimeSync>;
