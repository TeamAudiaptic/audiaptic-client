/**
 * Test event source: plays data/testSession.json into the processor as if
 * the events were arriving live from the server.
 *
 * The file's timestamps are fixed dates, which would already be in the past.
 * So we keep only the *time differences* between events and re-anchor them to
 * "now". Example with START_DELAY_MS = 2000 and Join pressed at time T:
 *
 *   file execTimestamp   offset from first   new execTimestamp
 *   1791244801000        0 ms                T + 2000
 *   1791244803000        2000 ms             T + 4000
 *   1791244805000        4000 ms             T + 6000
 */

import rawTestSession from "../../data/testSession.json";
import type { EventProcessor } from "./eventProcessor";
import { type SessionEvent, isSessionEvent } from "./events";

/** Gap between pressing Join and the first event, so you can watch it start. */
const START_DELAY_MS = 2000;

// JSON imports are loosely typed (e.g. `type` is just `string`), so we filter
// them through the same check the processor uses to get real SessionEvents.
const TEST_EVENTS = (rawTestSession as unknown[]).filter(isSessionEvent);

/**
 * Shifts events so the earliest one executes at `startAt`, keeping the
 * spacing between events and each event's send-ahead lead time.
 */
export function retimeEvents(events: SessionEvent[], startAt: number): SessionEvent[] {
  const firstExec = Math.min(...events.map((event) => event.execTimestamp));

  return events.map((event) => {
    // How far ahead of execution the event was sent (500 ms in the test file).
    const sendLead = event.execTimestamp - event.sentTimestamp;
    const execTimestamp = startAt + (event.execTimestamp - firstExec);
    return { ...event, execTimestamp, sentTimestamp: execTimestamp - sendLead };
  });
}

/**
 * Starts the test session. Each event is delivered at its `sentTimestamp`,
 * not all at once, to imitate a live performance.
 *
 * @returns `stop()`, which cancels any events not yet delivered.
 */
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
