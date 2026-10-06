import { useCallback, useEffect, useRef, useState } from "react";

import { createEventProcessor } from "@/lib/eventProcessor";
import { type TestSession, startTestSession } from "@/lib/testSessionSource";

/**
 * Connects the event processor to a React screen.
 *
 * @returns
 * - `active`: the event playing on each channel
 * - `log`: what happened to each event, newest first
 * - `isJoined`: whether a session is running
 * - `join()` / `leave()`: start or stop the session
 */
export function useEventProcessor() {
  // Passing the function (not calling it) makes React create the processor
  // only once, on first render, instead of on every render.
  const [processor] = useState(createEventProcessor);
  const [state, setState] = useState(processor.getState);
  const [isJoined, setIsJoined] = useState(false);

  // A ref, not state: changing the session shouldn't re-render the screen.
  const session = useRef<TestSession | null>(null);

  // Re-render whenever the processor changes. subscribe() returns the
  // unsubscribe function, which React calls as the cleanup.
  useEffect(() => processor.subscribe(setState), [processor]);

  const leave = useCallback(() => {
    session.current?.stop();
    session.current = null;
    processor.reset();
    setIsJoined(false);
  }, [processor]);

  const join = useCallback(() => {
    leave(); // start clean if a session was already running
    // Later: swap this for a live server source that also calls processor.receive().
    session.current = startTestSession(processor);
    setIsJoined(true);
  }, [processor, leave]);

  // Stop all timers if the screen goes away mid-session.
  useEffect(() => leave, [leave]);

  return { ...state, isJoined, join, leave };
}
