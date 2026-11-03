/**
 * Image output: turns the active image event into something an <Image> can show.
 */

import type { AssetUris } from "../concertAssets";
import type { SessionEvent } from "../events";

/**
 * The local URI and fade-in time for the active image event, or `null` when
 * no image is playing or its asset wasn't downloaded on join.
 */
export function getImage(imageEvent: SessionEvent | null, assets: AssetUris) {
  // Checking `type` also tells TypeScript the payload has an `assetAlias` field.
  if (imageEvent?.type !== "image") return null;

  const uri = assets[imageEvent.payload.assetAlias];
  if (!uri) return null;

  return { uri, transitionMs: imageEvent.payload.transitionMs ?? 0 };
}
