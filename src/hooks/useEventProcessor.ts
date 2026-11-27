import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { serverNow, subscribeToClock, timeSync } from "@/lib/clientTimeSync";
import {
  type AssetUris,
  deleteConcertAssets,
  downloadConcertAssets,
  findConcert,
  InvalidConcertCodeError,
} from "@/lib/concertAssets";
import { createEventProcessor } from "@/lib/eventProcessor";
import {
  type ConnectionState,
  EVENT_SOURCE,
  startServerSession,
} from "@/lib/serverSessionSource";
import { startTestSession } from "@/lib/testSessionSource";

/** Where the join flow is: not joined, fetching the concert's files, or running. */
export type JoinStatus = "idle" | "downloading" | "joined";

/** Either event source: the live server socket or the local test file. */
interface Session {
  stop: () => void;
}

const INVALID_CODE = "Invalid code";

/** The live server is the shared clock; the test file is timed on the phone's own clock. */
const USE_SERVER_CLOCK = EVENT_SOURCE === "server";

/** Reschedule pending events when an accepted offset moves server time by more than this (the spike's 5 ms). */
const RESCHEDULE_THRESHOLD_MS = 5;

function createProcessor() {
  return createEventProcessor({ now: USE_SERVER_CLOCK ? serverNow : Date.now });
}

/**
 * Connects the event processor to a React screen.
 *
 * @returns
 * - `active`: the event playing on each channel
 * - `log`: what happened to each event, newest first
 * - `status`: see JoinStatus; `isJoined` is `status === "joined"`
 * - `connection`: the server socket's state, or `null` when not using the server
 * - `error`: why the last join failed (e.g. "Invalid code"), or `null`
 * - `assets`: downloaded file name → local URI, for asset events
 * - `join(code)` / `leave()`: start or stop the session
 */
export function useEventProcessor() {
  // Passing the function (not calling it) makes React create the processor
  // only once, on first render, instead of on every render.
  const [processor] = useState(createProcessor);
  const [state, setState] = useState(processor.getState);
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetUris>({});

  // Refs, not state: changing these shouldn't re-render the screen.
  const session = useRef<Session | null>(null);
  // Bumped on every join/leave, so a download or socket callback that arrives
  // after the user pressed Leave (or joined again) knows its result is stale.
  const attempt = useRef(0);

  // Re-render whenever the processor changes. subscribe() returns the
  // unsubscribe function, which React calls as the cleanup.
  useEffect(() => processor.subscribe(setState), [processor]);

  // Release held events once the first burst finishes, and keep pending ones
  // on time when a later burst moves the offset.
  useEffect(
    () =>
      subscribeToClock(({ accepted, shiftMs }) => {
        // Released even if the first burst failed: events then run on the
        // phone's clock (and are rescheduled once a later burst succeeds)
        // rather than never playing while the server's time can't be reached.
        processor.setClockReady(true);
        if (accepted && Math.abs(shiftMs) > RESCHEDULE_THRESHOLD_MS) processor.rescheduleTimers();
      }),
    [processor],
  );

  // Coming back to the foreground: timers were paused and the network may
  // have changed, so the offset may be stale.
  const isJoined = status === "joined";
  useEffect(() => {
    if (!isJoined || !USE_SERVER_CLOCK) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") timeSync.syncNow();
    });
    return () => subscription.remove();
  }, [isJoined]);

  /** Stops the session but keeps downloaded files, so re-joining doesn't download them again. */
  const stop = useCallback(() => {
    attempt.current += 1;
    session.current?.stop();
    session.current = null;
    timeSync.stop(); // the last offset is kept, so re-joining starts with it
    processor.reset();
    setStatus("idle");
    setConnection(null);
  }, [processor]);

  /** Stops the session and deletes the concert's downloaded files. */
  const leave = useCallback(() => {
    stop();
    setAssets({});
    try {
      deleteConcertAssets();
    } catch (e) {
      // Not worth bothering the user: the next join clears leftovers, and
      // the OS may clear the cache folder itself when space is low.
      console.warn("Couldn't delete concert files", e);
    }
  }, [stop]);

  const join = useCallback(
    async (code: string) => {
      stop(); // start clean if a session was already running

      const concert = findConcert(code.trim());
      if (!concert) {
        setError(INVALID_CODE);
        return;
      }

      const thisAttempt = attempt.current;
      const isCurrent = () => attempt.current === thisAttempt;
      setError(null);
      setStatus("downloading");

      if (USE_SERVER_CLOCK) {
        // Hold events until the clock is synced. The first burst runs during
        // the download, so it's normally done before the socket connects.
        if (!timeSync.isSynced()) processor.setClockReady(false);
        timeSync.start();
      }

      try {
        const downloaded = await downloadConcertAssets(concert.assetFolder);
        if (!isCurrent()) return;
        setAssets(downloaded);
      } catch (e) {
        if (!isCurrent()) return;
        if (e instanceof InvalidConcertCodeError) {
          setError(INVALID_CODE);
        } else {
          console.warn("Asset download failed", e);
          setError("Couldn't download the concert files. Check your connection and try again.");
        }
        stop();
        return;
      }

      let lastConnection: ConnectionState | null = null;
      session.current =
        EVENT_SOURCE === "testFile"
          ? startTestSession(processor)
          : startServerSession(processor, concert.code, {
              onStateChange: (next) => {
                if (!isCurrent()) return;
                // Reconnected: the network path may have changed, so re-measure.
                if (next === "connected" && lastConnection === "reconnecting") timeSync.syncNow();
                lastConnection = next;
                setConnection(next);
              },
              onInvalidCode: () => {
                if (!isCurrent()) return;
                stop();
                setError(INVALID_CODE);
              },
            });
      setStatus("joined");
    },
    [processor, stop],
  );

  // Stop all timers and delete the files if the screen goes away mid-session.
  useEffect(() => leave, [leave]);

  return {
    ...state,
    status,
    isJoined,
    connection,
    error,
    assets,
    join,
    leave,
  };
}
