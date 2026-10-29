/**
 * Event processor: the "brain" that decides what plays on each output.
 *
 * How an event flows through it:
 *
 *   source ──receive()──► checks ──runAt(exec)──► start() ──runAt(end)──► finish()
 *   (test file or                     (wait until the        (conflict      (clear the
 *    server socket)                    execution time)        check)         channel)
 *
 * The execution time comes from the event's timestamps (see execTimeOf):
 * a future `epochTimestamp`, else Start time + `relativeTimestamp`, else now.
 * Relative events that arrive before the Start event has executed wait in
 * `waiting` until it does.
 *
 * Key ideas:
 * - A *channel* is one output: haptic, torch, color or image. Each channel shows at
 *   most one event at a time; different channels never affect each other.
 * - On the same channel the event with the higher `sequence` wins. Arrival
 *   order does not matter, so a late-arriving older event can't take over.
 * - The processor never loads data itself. Whatever produces events (a test
 *   file now, the live server later) just calls `receive()` for each one.
 * - The UI never reads internals; it subscribes and gets a fresh, immutable
 *   `ProcessorState` object every time something changes.
 */

import {
  type Channel,
  type SessionEvent,
  type StartEvent,
  endsAt,
  isIncomingEvent,
} from "./events";

/** The event currently playing on each channel, or `null` when it's idle. */
export type ActiveEvents = Record<Channel, SessionEvent | null>;

/** What happened to an event, recorded in the log for debugging. */
export type Outcome =
  | "played" // became the active event on its channel
  | "replaced by newer" // a higher-sequence event took over its channel
  | "discarded: lower seq" // lost a conflict, so it never played
  | "ended" // its duration ran out
  | "skipped: duplicate" // an event with this eventId was already received
  | "skipped: expired" // it would already be over by the time it arrived
  | "waiting for start" // relative timestamp, but the Start event hasn't executed yet
  | "started" // a Start event executed; relative timestamps count from here
  | "rejected: invalid"; // the message wasn't a usable event

export interface LogEntry {
  /** When this happened (Unix ms). */
  at: number;
  eventId: string;
  outcome: Outcome;
}

/** Everything the UI needs to render. A new object is made on every change. */
export interface ProcessorState {
  active: ActiveEvents;
  /** Newest entry first. */
  log: LogEntry[];
}

type Listener = (state: ProcessorState) => void;

/** Keep the log short so long sessions don't grow memory or slow rendering. */
const MAX_LOG_ENTRIES = 50;

const INITIAL_STATE: ProcessorState = {
  active: { haptic: null, torch: null, color: null, image: null },
  log: [],
};

/**
 * Creates a processor. Each joined session should use one processor.
 *
 * @example
 * const processor = createEventProcessor();
 * const unsubscribe = processor.subscribe((state) => console.log(state.active));
 * processor.receive(eventFromServer);
 */
export function createEventProcessor() {
  // Private state lives in this closure; only the returned functions can touch it.
  let state = INITIAL_STATE;
  const listeners = new Set<Listener>();
  const seenIds = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /** When the Start event executed (Unix ms), or `null` before it has. */
  let performanceStartedAt: number | null = null;
  /** Relative-timestamp events received before the Start event executed. */
  let waiting: SessionEvent[] = [];

  /** Swap in a new state object and tell every subscriber. */
  function setState(next: ProcessorState) {
    state = next;
    listeners.forEach((listener) => listener(state));
  }

  function setActive(channel: Channel, event: SessionEvent | null) {
    setState({ ...state, active: { ...state.active, [channel]: event } });
  }

  function log(eventId: string, outcome: Outcome) {
    const entry = { at: Date.now(), eventId, outcome };
    setState({ ...state, log: [entry, ...state.log].slice(0, MAX_LOG_ENTRIES) });
  }

  /**
   * Runs `task` at the given Unix ms time, or right away if that time has
   * passed (so events that arrive a little late still play). Timers are
   * tracked so `reset()` can cancel them all.
   */
  function runAt(time: number, task: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      task();
    }, Math.max(0, time - Date.now()));
    timers.add(timer);
  }

  /**
   * When an event should execute (Unix ms), or `null` if it is relative to a
   * Start event that hasn't executed yet. Missing, `null` and 0 timestamps
   * all mean "not set".
   */
  function execTimeOf(event: SessionEvent): number | null {
    const epoch = event.epochTimestamp || 0;
    const relative = event.relativeTimestamp || 0;

    // A future epoch timestamp takes precedence over a relative one.
    if (epoch > Date.now()) return epoch;
    if (relative) return performanceStartedAt === null ? null : performanceStartedAt + relative;
    // A past epoch timestamp still counts, so the expiry check can catch it.
    return epoch || Date.now();
  }

  /** Plays `event` at `execAt`, unless it would already be over. */
  function schedule(event: SessionEvent, execAt: number) {
    if (endsAt(event, execAt) <= Date.now()) return log(event.eventId, "skipped: expired");
    runAt(execAt, () => start(event, execAt));
  }

  /** Called when a Start event executes: anchor relative timestamps and release waiting events. */
  function startPerformance(event: StartEvent, startedAt: number) {
    performanceStartedAt = startedAt;
    log(event.eventId, "started");

    const released = waiting;
    waiting = [];
    released.forEach((waitingEvent) => schedule(waitingEvent, execTimeOf(waitingEvent)!));
  }

  /** Called at an event's execution time: resolve the conflict, then play it. */
  function start(event: SessionEvent, startedAt: number) {
    const current = state.active[event.type];

    // Priority rule: higher sequence = newer = wins.
    if (current && current.sequence > event.sequence) {
      log(event.eventId, "discarded: lower seq");
      return;
    }
    if (current) log(current.eventId, "replaced by newer");

    setActive(event.type, event);
    log(event.eventId, "played");
    runAt(endsAt(event, startedAt), () => finish(event));
  }

  /** Called when an event's duration is over. */
  function finish(event: SessionEvent) {
    // If a newer event replaced this one, the channel isn't ours to clear.
    // Comparing eventIds stops an old timer from wiping out the new event.
    if (state.active[event.type]?.eventId !== event.eventId) return;

    setActive(event.type, null);
    log(event.eventId, "ended");
  }

  /**
   * Hands one event to the processor. Safe to call with anything, such as a
   * parsed server message: unusable input is logged and ignored.
   */
  function receive(input: unknown) {
    if (!isIncomingEvent(input)) return log("unknown", "rejected: invalid");
    // A reconnecting socket may resend events we already have.
    if (seenIds.has(input.eventId)) return log(input.eventId, "skipped: duplicate");
    seenIds.add(input.eventId);

    if (input.type === "start") {
      // Start can't be relative to itself, so only its epoch timestamp counts.
      // A past epoch is kept as-is so a late joiner still lines up with everyone else.
      const startedAt = input.epochTimestamp || Date.now();
      return runAt(startedAt, () => startPerformance(input, startedAt));
    }

    const execAt = execTimeOf(input);
    if (execAt === null) {
      waiting.push(input);
      return log(input.eventId, "waiting for start");
    }
    schedule(input, execAt);
  }

  /**
   * Calls `listener` with the new state after every change.
   * @returns A function that stops listening (handy as a React effect cleanup).
   */
  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /** Cancels everything scheduled and goes back to the empty state. */
  function reset() {
    timers.forEach(clearTimeout);
    timers.clear();
    seenIds.clear();
    performanceStartedAt = null;
    waiting = [];
    setState(INITIAL_STATE);
  }

  return { receive, subscribe, getState: () => state, reset };
}

export type EventProcessor = ReturnType<typeof createEventProcessor>;
