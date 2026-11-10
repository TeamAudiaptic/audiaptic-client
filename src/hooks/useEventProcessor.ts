import { useCallback, useEffect, useRef, useState } from "react";

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
  const [processor] = useState(createEventProcessor);
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

  /** Stops the session but keeps downloaded files, so re-joining doesn't download them again. */
  const stop = useCallback(() => {
    attempt.current += 1;
    session.current?.stop();
    session.current = null;
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
        setStatus("idle");
        return;
      }

      session.current =
        EVENT_SOURCE === "testFile"
          ? startTestSession(processor)
          : startServerSession(processor, concert.code, {
              onStateChange: (next) => {
                if (isCurrent()) setConnection(next);
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
    isJoined: status === "joined",
    connection,
    error,
    assets,
    join,
    leave,
  };
}
