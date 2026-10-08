/**
 * Color output: turns the active color event into the screen's background.
 */

import type { SessionEvent } from "../events";

/**
 * The background color to show for the active color event.
 * Returns the event's "#RRGGBB" hex code, or `null` when no color is playing.
 */
export function getBackgroundColor(colorEvent: SessionEvent | null) {
  // Checking `type` also tells TypeScript the payload has a `color` field.
  if (colorEvent?.type !== "color") return null;

  return colorEvent.payload.color;
}
