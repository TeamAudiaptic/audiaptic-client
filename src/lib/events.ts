/**
 * Event types, matching audiaptic-docs/docs/dev-docs/events/*.mdx.
 * All timestamps are Unix epoch milliseconds; all durations are milliseconds.
 */

/** One output on the device. Each event type drives exactly one channel. */
export type Channel = "haptic" | "torch" | "color";

export const CHANNELS: Channel[] = ["haptic", "torch", "color"];

/** Fields every event has, whatever its type (see shared-envelope.mdx). */
interface EventEnvelope<T extends Channel, P> {
  schemaVersion: "1.0";
  /** Unique within a session; used to drop duplicates. */
  eventId: string;
  /** Increases with every event Max sends. Higher wins a conflict. */
  sequence: number;
  type: T;
  /** When Max sent the event. */
  sentTimestamp: number;
  /** When every device should start the event. */
  execTimestamp: number;
  /** Type-specific settings, shown below. */
  payload: P;
}

export interface HapticPayload {
  /** Strength from 0 to 1. */
  intensity: number;
  /** Feel from soft (0) to crisp (1). Optional. */
  sharpness?: number;
  /** 0 means "until replaced". */
  durationMs: number;
  /** Fade time from the previous state. Optional. */
  transitionMs?: number;
}

export interface TorchPayload {
  /** Brightness from 0 to 1 on devices that support it. Defaults to full. */
  intensity?: number;
  durationMs: number;
  transitionMs?: number;
}

export interface ColorPayload {
  /** Screen color as "#RRGGBB". */
  color: string;
  durationMs: number;
  transitionMs?: number;
}

/**
 * Any event the processor understands. This is a *discriminated union*:
 * checking `event.type === "color"` tells TypeScript the payload is a
 * ColorPayload, so `event.payload.color` is allowed.
 */
export type SessionEvent =
  | EventEnvelope<"haptic", HapticPayload>
  | EventEnvelope<"torch", TorchPayload>
  | EventEnvelope<"color", ColorPayload>;

/** When the event stops. A duration of 0 means "until replaced". */
export function endsAt(event: SessionEvent): number {
  const { durationMs } = event.payload;
  return durationMs === 0 ? Infinity : event.execTimestamp + durationMs;
}

/**
 * Quick check that `value` looks like an event the processor can handle.
 *
 * It only checks the fields the processor depends on; the server does the
 * full validation (ranges, hex colors, ...). As a type guard, a `true` result
 * lets TypeScript treat `value` as a SessionEvent afterwards.
 */
export function isSessionEvent(value: unknown): value is SessionEvent {
  const event = value as Partial<SessionEvent> | null;

  return (
    CHANNELS.includes(event?.type as Channel) &&
    typeof event?.eventId === "string" &&
    typeof event.sequence === "number" &&
    typeof event.execTimestamp === "number" &&
    typeof event.payload?.durationMs === "number"
  );
}
