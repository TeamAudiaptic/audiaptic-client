// Plays data/testSession.json into the processor as if it were arriving live.
// The file's timestamps are fixed, so only the time differences between
// events are kept and re-anchored to "now".

import rawTestSession from "../../data/testSession.json";
import type { EventProcessor } from "./eventProcessor";
import { type SessionEvent, isSessionEvent } from "./events";

const START_DELAY_MS = 2000;

const TEST_EVENTS = (rawTestSession as unknown[]).filter(isSessionEvent);

export function retimeEvents(events: SessionEvent[], startAt: number): SessionEvent[] {
  const firstExec = Math.min(...events.map((event) => event.execTimestamp));

  return events.map((event) => {
    const sendLead = event.execTimestamp - event.sentTimestamp;
    const execTimestamp = startAt + (event.execTimestamp - firstExec);
    return { ...event, execTimestamp, sentTimestamp: execTimestamp - sendLead };
  });
}

export function startTestSession(processor: EventProcessor) {
  const events = retimeEvents(TEST_EVENTS, Date.now() + START_DELAY_MS);

  const timers = events.map((event) =>
    setTimeout(() => processor.receive(event), event.sentTimestamp - Date.now()),
  );

  return {
    stop: () => timers.forEach(clearTimeout),
  };
}

export type TestSession = ReturnType<typeof startTestSession>;
