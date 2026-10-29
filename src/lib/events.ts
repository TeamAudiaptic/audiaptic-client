/**
 * Event types, matching audiaptic-docs/docs/dev-docs/events/*.mdx.
 * All timestamps are Unix epoch milliseconds; all durations are milliseconds.
 */

/** One output on the device. Each event type drives exactly one channel. */
export type Channel = "haptic" | "torch" | "color" | "image" | "audio" | "video";

export const CHANNELS: Channel[] = ["haptic", "torch", "color", "image", "audio", "video"];

/** Channels whose events play a downloaded file named by `payload.assetAlias`. */
const ASSET_CHANNELS: Channel[] = ["image", "audio", "video"];

/**
 * Fields every event has, whatever its type (see shared-envelope.mdx).
 *
 * Timing: if both timestamps are missing, `null` or 0 the event runs as soon
 * as it arrives. `epochTimestamp` wins when it's in the future; otherwise a
 * `relativeTimestamp` counts from when the Start event executed.
 */
interface BaseEnvelope<T extends string> {
  schemaVersion: "1.0";
  /** Unique within a session; used to drop duplicates. */
  eventId: string;
  /** Increases with every event Max sends. Higher wins a conflict. */
  sequence: number;
  type: T;
  /** When Max sent the event. Optional. */
  sentTimestamp?: number | null;
  /** Unix ms at which every device should start the event. Optional. */
  epochTimestamp?: number | null;
  /** Ms after the Start event executes at which to start the event. Optional. */
  relativeTimestamp?: number | null;
}

interface EventEnvelope<T extends Channel, P> extends BaseEnvelope<T> {
  /** Type-specific settings, shown below. */
  payload: P;
}

/** Marks the start of the performance; relative timestamps count from it (start.mdx). */
export type StartEvent = BaseEnvelope<"start">;

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

export interface ImagePayload {
  /** File name of an asset downloaded on join (see concertAssets.ts). */
  assetAlias: string;
  /** Optional; missing or 0 means "until replaced". */
  durationMs?: number;
  /** Fade-in time. Optional. */
  transitionMs?: number;
}

export interface AudioPayload {
  /** File name of an asset downloaded on join. */
  assetAlias: string;
  /** Where in the file to start. Defaults to 0. */
  startOffsetMs?: number;
  /** Clip length. Missing or 0 plays to the end of the file. */
  durationMs?: number;
  /** Volume fade-in time. Optional. */
  transitionMs?: number;
}

export interface VideoPayload {
  /** File name of an asset downloaded on join. Plays full-screen. */
  assetAlias: string;
  /** Where in the video to start. Defaults to 0. */
  startOffsetMs?: number;
  /** Clip length. Missing or 0 plays to the end of the video. */
  durationMs?: number;
  /** Restart from the start when the video ends, until the duration is up. */
  loop?: boolean;
  /** Fade-in time. Optional. */
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
  | EventEnvelope<"color", ColorPayload>
  | EventEnvelope<"image", ImagePayload>
  | EventEnvelope<"audio", AudioPayload>
  | EventEnvelope<"video", VideoPayload>;

/** Anything the processor accepts: an output event or the Start event. */
export type IncomingEvent = SessionEvent | StartEvent;

/**
 * When the event stops, given when it started. A missing or 0 duration means
 * "until replaced"; audio and video then also stop by themselves when the file
 * ends, but the processor doesn't know the file's length.
 */
export function endsAt(event: SessionEvent, startedAt: number): number {
  const { durationMs } = event.payload;
  return durationMs ? startedAt + durationMs : Infinity;
}

/** Optional timestamp fields may be absent, `null` or a number. */
function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "number";
}

/** Checks the envelope fields shared by every event type. */
function hasEnvelope(value: unknown): value is BaseEnvelope<string> {
  const event = value as Partial<BaseEnvelope<string>> | null;

  return (
    typeof event?.eventId === "string" &&
    typeof event.sequence === "number" &&
    isOptionalNumber(event.sentTimestamp) &&
    isOptionalNumber(event.epochTimestamp) &&
    isOptionalNumber(event.relativeTimestamp)
  );
}

/**
 * Quick check that `value` looks like an output event the processor can handle.
 *
 * It only checks the fields the processor depends on; the server does the
 * full validation (ranges, hex colors, ...). As a type guard, a `true` result
 * lets TypeScript treat `value` as a SessionEvent afterwards.
 */
export function isSessionEvent(value: unknown): value is SessionEvent {
  if (!hasEnvelope(value) || !CHANNELS.includes(value.type as Channel)) return false;

  const { payload } = value as Partial<SessionEvent>;
  if (typeof payload !== "object" || payload === null) return false;
  // Asset events name a file and may leave out their duration.
  if (ASSET_CHANNELS.includes(value.type as Channel)) {
    const asset = payload as Partial<AudioPayload>;
    return (
      typeof asset.assetAlias === "string" &&
      isOptionalNumber(asset.durationMs) &&
      isOptionalNumber(asset.startOffsetMs)
    );
  }
  return typeof payload.durationMs === "number";
}

export function isStartEvent(value: unknown): value is StartEvent {
  return hasEnvelope(value) && value.type === "start";
}

export function isIncomingEvent(value: unknown): value is IncomingEvent {
  return isSessionEvent(value) || isStartEvent(value);
}
