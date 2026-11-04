/**
 * Caption output: turns the active caption event into text to display.
 */

import type { SessionEvent } from "../events";

/**
 * The text to display for the active caption event, or `null` when no
 * caption is playing.
 */
export function getCaption(captionEvent: SessionEvent | null): string | null {
  // Checking `type` also tells TypeScript the payload has a `text` field.
  if (captionEvent?.type !== "caption") return null;

  return captionEvent.payload.text;
}

