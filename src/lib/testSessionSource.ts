/**
 * Test event source: plays data/testSession.json into the processor as if
 * the events were arriving live from the server.
 *
 * The file's timestamps are fixed dates, which would already be in the past.
 * So we shift every absolute timestamp (`epochTimestamp`, `sentTimestamp`) by
 * the same amount, so the earliest epoch (the Start event) lands just after
 * "now". `relativeTimestamp`s count from Start, so they need no change.
 * Example with START_DELAY_MS = 2000 and Join pressed at time T:
 *
 *   event              file timestamp            new timestamp
 *   start              epoch 1791244800500       epoch T + 2000
 *   haptic             relative 500              relative 500 (plays at T + 2500)
 *   torch-gradual-fade epoch 1791244810500       epoch T + 12000
 */

import rawTestSession from "../../data/testSession.json";
import type { EventProcessor } from "./eventProcessor";
import { type IncomingEvent, isIncomingEvent } from "./events";

/** Gap between pressing Join and the Start event, so you can watch it start. */
const START_DELAY_MS = 2000;

// JSON imports are loosely typed (e.g. `type` is just `string`), so we filter
// them through the same check the processor uses to get real events.
const TEST_EVENTS = (rawTestSession as unknown[]).filter(isIncomingEvent);

/** Adds `offset` to a timestamp, leaving unset ones (missing, null or 0) alone. */
function shift(timestamp: number | null | undefined, offset: number) {
  return timestamp ? timestamp + offset : timestamp;
}

/**
 * Shifts events so the earliest epoch timestamp falls at `startAt`, keeping
 * the spacing between events and each event's send-ahead lead time.
 */
export function retimeEvents(events: IncomingEvent[], startAt: number): IncomingEvent[] {
  const epochs = events
    .map((event) => event.epochTimestamp)
    .filter((epoch): epoch is number => !!epoch);
  const offset = startAt - Math.min(...epochs);

  return events.map((event) => ({
    ...event,
    epochTimestamp: shift(event.epochTimestamp, offset),
    sentTimestamp: shift(event.sentTimestamp, offset),
  }));
}

/**
 * Starts the test session. Each event is delivered at its `sentTimestamp`
 * (or right away if it has none), not all at once, to imitate a live performance.
 *
 * @returns `stop()`, which cancels any events not yet delivered.
 */
export function startTestSession(processor: EventProcessor) {
  const events = retimeEvents(TEST_EVENTS, Date.now() + START_DELAY_MS);

  const timers = events.map((event) =>
    setTimeout(() => processor.receive(event), (event.sentTimestamp ?? Date.now()) - Date.now()),
  );

  return {
    stop: () => timers.forEach(clearTimeout),
  };
}

export type TestSession = ReturnType<typeof startTestSession>;
