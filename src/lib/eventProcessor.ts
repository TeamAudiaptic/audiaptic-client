// Takes events one at a time (from the test file now, from the server later),
// starts each at its execTimestamp, and keeps track of which event is active
// on each channel. On the same channel the higher sequence always wins,
// no matter which event arrived first.

import { type Channel, type SessionEvent, endsAt, isSessionEvent } from "./events";

export type ActiveEvents = Record<Channel, SessionEvent | null>;

export type Outcome =
  | "played"
  | "replaced by newer"
  | "discarded: lower seq"
  | "ended"
  | "skipped: duplicate"
  | "skipped: expired"
  | "rejected: invalid";

export interface LogEntry {
  at: number;
  eventId: string;
  outcome: Outcome;
}

export interface ProcessorState {
  active: ActiveEvents;
  log: LogEntry[];
}

type Listener = (state: ProcessorState) => void;

const MAX_LOG_ENTRIES = 50;

const INITIAL_STATE: ProcessorState = {
  active: { haptic: null, torch: null, color: null },
  log: [],
};

export function createEventProcessor() {
  let state = INITIAL_STATE;
  const listeners = new Set<Listener>();
  const seenIds = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

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

  function runAt(time: number, task: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      task();
    }, Math.max(0, time - Date.now()));
    timers.add(timer);
  }

  function start(event: SessionEvent) {
    const current = state.active[event.type];

    if (current && current.sequence > event.sequence) {
      log(event.eventId, "discarded: lower seq");
      return;
    }
    if (current) log(current.eventId, "replaced by newer");

    setActive(event.type, event);
    log(event.eventId, "played");
    runAt(endsAt(event), () => finish(event));
  }

  function finish(event: SessionEvent) {
    // A newer event may already own this channel; leave it alone.
    if (state.active[event.type]?.eventId !== event.eventId) return;

    setActive(event.type, null);
    log(event.eventId, "ended");
  }

  function receive(input: unknown) {
    if (!isSessionEvent(input)) return log("unknown", "rejected: invalid");
    if (seenIds.has(input.eventId)) return log(input.eventId, "skipped: duplicate");
    if (endsAt(input) <= Date.now()) return log(input.eventId, "skipped: expired");

    seenIds.add(input.eventId);
    runAt(input.execTimestamp, () => start(input));
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function reset() {
    timers.forEach(clearTimeout);
    timers.clear();
    seenIds.clear();
    setState(INITIAL_STATE);
  }

  return { receive, subscribe, getState: () => state, reset };
}

export type EventProcessor = ReturnType<typeof createEventProcessor>;
