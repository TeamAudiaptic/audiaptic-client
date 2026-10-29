import { useCallback, useEffect, useRef, useState } from "react";

import {
  type AssetUris,
  deleteConcertAssets,
  downloadConcertAssets,
  isValidConcertCode,
} from "@/lib/concertAssets";
import { createEventProcessor } from "@/lib/eventProcessor";
import { type TestSession, startTestSession } from "@/lib/testSessionSource";

/** Where the join flow is: not joined, fetching the concert's files, or running. */
export type JoinStatus = "idle" | "downloading" | "joined";

/**
 * Connects the event processor to a React screen.
 *
 * @returns
 * - `active`: the event playing on each channel
 * - `log`: what happened to each event, newest first
 * - `status`: see JoinStatus; `isJoined` is `status === "joined"`
 * - `error`: why the last join failed (e.g. "Invalid code"), or `null`
 * - `assets`: downloaded file name → local URI, for image events
 * - `join(code)` / `leave()`: start or stop the session
 */
export function useEventProcessor() {
  // Passing the function (not calling it) makes React create the processor
  // only once, on first render, instead of on every render.
  const [processor] = useState(createEventProcessor);
  const [state, setState] = useState(processor.getState);
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetUris>({});

  // Refs, not state: changing these shouldn't re-render the screen.
  const session = useRef<TestSession | null>(null);
  // Bumped on every join/leave, so a download that finishes after the user
  // pressed Leave (or joined again) knows its result is stale.
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
      if (!isValidConcertCode(code)) {
        setError("Invalid code");
        return;
      }

      const thisAttempt = attempt.current;
      setError(null);
      setStatus("downloading");
      try {
        const downloaded = await downloadConcertAssets(code.trim());
        if (attempt.current !== thisAttempt) return;
        setAssets(downloaded);
      } catch (e) {
        if (attempt.current !== thisAttempt) return;
        console.warn("Asset download failed", e);
        setError("Couldn't download the concert files. Check your connection and try again.");
        setStatus("idle");
        return;
      }

      // Later: swap this for a live server source that also calls processor.receive().
      session.current = startTestSession(processor);
      setStatus("joined");
    },
    [processor, stop],
  );

  // Stop all timers and delete the files if the screen goes away mid-session.
  useEffect(() => leave, [leave]);

  return { ...state, status, isJoined: status === "joined", error, assets, join, leave };
}
