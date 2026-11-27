/**
 * The app's one time-sync controller, connected to the DAVHI server's
 * GET /api/time. The algorithm itself is in timeSync.ts.
 *
 * `serverNow()` is the clock the event processor reads in place of
 * `Date.now()`, so every phone measures event times against the server's
 * clock rather than its own. Until the first sync it is the phone's clock.
 *
 * When to sync is decided by useEventProcessor: on join, when the socket
 * reconnects, and when the app returns to the foreground. While started, the
 * controller also re-syncs every 60 s and when it sees the phone's clock change.
 */

import { SERVER_URL } from "./serverSessionSource";
import { createTimeSync, type SyncResult } from "./timeSync";

/** Give up on a single /api/time request after this long (the spike's 2 s). */
const REQUEST_TIMEOUT_MS = 2000;

/** The HTTP(S) URL of the time endpoint on the same server as the sockets. */
const TIME_URL = `${SERVER_URL.replace(/^ws(s?):/i, "http$1:")}/api/time`;

/** One request to GET /api/time. Resolves with the server's epoch ms. */
async function fetchServerTime(): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(TIME_URL, {
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    const serverTimestamp = (body as { serverTimestamp?: unknown } | null)?.serverTimestamp;
    if (typeof serverTimestamp !== "number" || !Number.isFinite(serverTimestamp)) {
      throw new Error("response has no serverTimestamp");
    }
    return serverTimestamp;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`timed out after ${REQUEST_TIMEOUT_MS} ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ClockUpdate extends SyncResult {
  /**
   * How far server time jumped with this result (ms), compared with the
   * clock the app was using before it. 0 when the offset didn't change.
   */
  shiftMs: number;
}

type Listener = (update: ClockUpdate) => void;
const listeners = new Set<Listener>();

let lastResult: SyncResult | null = null;

/**
 * Logs every burst's outcome, e.g.
 * "Clock sync accepted: offset +1398.8 ms ±23.1 ms (moved +1398.8 ms)".
 * The offset is server time minus this device's clock. The spike's
 * validation starts with collecting these errors from every device.
 */
function logBurst(result: SyncResult, shiftMs: number) {
  const { status } = result;
  // A failed burst was already warned about, with its reason
  if (result.reason || !status.synced) return;

  const signed = (ms: number) => `${ms >= 0 ? "+" : ""}${ms.toFixed(1)}`;
  const outcome = result.accepted ? "accepted" : "rejected, kept the previous offset";
  console.log(
    `Clock sync ${outcome}: offset ${signed(status.wallOffset)} ms ±${status.error.toFixed(1)} ms` +
      (result.accepted ? ` (moved ${signed(shiftMs)} ms)` : ""),
  );
}

/** Server time minus the monotonic clock: what serverNow() adds right now. */
function currentOffset(): number {
  return timeSync.serverNow() - performance.now();
}
let offsetBefore = 0;

export const timeSync = createTimeSync({
  fetchServerTime,
  monotonicNow: () => performance.now(),
  wallNow: () => Date.now(),
  onResult: (result) => {
    lastResult = result;
    const offsetAfter = currentOffset();
    const shiftMs = result.accepted ? offsetAfter - offsetBefore : 0;
    offsetBefore = offsetAfter;
    if (result.reason) console.warn(result.reason);
    logBurst(result, shiftMs);
    listeners.forEach((listener) => listener({ ...result, shiftMs }));
  },
});

// Before the first sync serverNow() is the wall clock; remember that as the
// starting point so the first accepted result reports how far it moved.
offsetBefore = currentOffset();

/** The clock the event processor uses: the server's time, in epoch ms. */
export function serverNow(): number {
  return timeSync.serverNow();
}

/** The most recent burst's result, or null if none has finished yet. */
export function lastSyncResult(): SyncResult | null {
  return lastResult;
}

/**
 * Calls `listener` after every burst.
 * @returns A function that stops listening (handy as a React effect cleanup).
 */
export function subscribeToClock(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
