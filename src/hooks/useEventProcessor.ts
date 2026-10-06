import { useCallback, useEffect, useRef, useState } from "react";

import { createEventProcessor } from "@/lib/eventProcessor";
import { type TestSession, startTestSession } from "@/lib/testSessionSource";

export function useEventProcessor() {
  const [processor] = useState(createEventProcessor);
  const [state, setState] = useState(processor.getState);
  const [isJoined, setIsJoined] = useState(false);
  const session = useRef<TestSession | null>(null);

  useEffect(() => processor.subscribe(setState), [processor]);

  const leave = useCallback(() => {
    session.current?.stop();
    session.current = null;
    processor.reset();
    setIsJoined(false);
  }, [processor]);

  const join = useCallback(() => {
    leave();
    session.current = startTestSession(processor);
    setIsJoined(true);
  }, [processor, leave]);

  // Stop all timers if the screen goes away mid-session.
  useEffect(() => leave, [leave]);

  return { ...state, isJoined, join, leave };
}
