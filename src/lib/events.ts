// Event shapes from audiaptic-docs/docs/dev-docs/events/*.mdx

export type Channel = "haptic" | "torch" | "color";

export const CHANNELS: Channel[] = ["haptic", "torch", "color"];

interface EventEnvelope<T extends Channel, P> {
  schemaVersion: "1.0";
  eventId: string;
  sequence: number;
  type: T;
  sentTimestamp: number;
  execTimestamp: number;
  payload: P;
}

export interface HapticPayload {
  intensity: number;
  sharpness?: number;
  durationMs: number;
  transitionMs?: number;
}

export interface TorchPayload {
  intensity?: number;
  durationMs: number;
  transitionMs?: number;
}

export interface ColorPayload {
  color: string;
  durationMs: number;
  transitionMs?: number;
}

export type SessionEvent =
  | EventEnvelope<"haptic", HapticPayload>
  | EventEnvelope<"torch", TorchPayload>
  | EventEnvelope<"color", ColorPayload>;

/** When the event stops. A duration of 0 means "until replaced". */
export function endsAt(event: SessionEvent): number {
  const { durationMs } = event.payload;
  return durationMs === 0 ? Infinity : event.execTimestamp + durationMs;
}

/** Checks the fields the processor depends on; the server does full validation. */
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
