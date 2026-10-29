/**
 * Which files belong to a concert, and where to download them.
 *
 * Files live in a public R2 bucket under a folder named after the concert:
 *
 *   https://pub-....r2.dev/concert-1/12in-Vinyl-LP-Record-Angle.jpg
 *   └──── ASSET_BASE_URL ───┘ └code─┘ └──────── file name ─────────┘
 *
 * The bucket can't list its own contents, so data/concertCode.json says which
 * files each concert has. On join, every file is downloaded to the device's
 * cache so events can show it without waiting on the network.
 */

import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import concert from "../../data/concertCode.json";

/** Everything before the concert code; the same for every concert. */
export const ASSET_BASE_URL = "https://pub-c69c5d6678254b90a1f1cac88377e860.r2.dev";

export const CONCERT_CODE: string = concert.concertCode;
export const CONCERT_FILES: string[] = concert.files;

/** Download URL for one of a concert's files. */
export function assetUrl(fileName: string, concertCode: string = CONCERT_CODE): string {
  return `${ASSET_BASE_URL}/${encodeURIComponent(concertCode)}/${encodeURIComponent(fileName)}`;
}

/** Download URLs for every file in the concert, in the order listed. */
export function concertAssetUrls(): string[] {
  return CONCERT_FILES.map((fileName) => assetUrl(fileName));
}

/** Whether `code` (as typed by the user) is a known concert. */
export function isValidConcertCode(code: string): boolean {
  return code.trim() === CONCERT_CODE;
}

/** File name (an event's `assetAlias`) → URI an <Image> can show. */
export type AssetUris = Record<string, string>;

/** Holds one folder per concert. A function, as expo-file-system can't be touched on web. */
function concertsFolder() {
  return new Directory(Paths.cache, "concerts");
}

/**
 * Deletes everything in the concerts folder except this concert's listed
 * files, e.g. files from another concert, or from an app run that was closed
 * without pressing Leave.
 */
function removeStaleAssets(concertCode: string) {
  const root = concertsFolder();
  if (!root.exists) return;

  for (const entry of root.list()) {
    if (entry.name !== concertCode || !(entry instanceof Directory)) {
      entry.delete();
      continue;
    }
    for (const file of entry.list()) {
      if (!CONCERT_FILES.includes(file.name)) file.delete();
    }
  }
}

/**
 * Deletes every downloaded concert file. Called on Leave. Safe to call when
 * nothing was downloaded; on web there is nothing to delete.
 */
export function deleteConcertAssets() {
  if (Platform.OS === "web") return;

  const root = concertsFolder();
  if (root.exists) root.delete();
}

/**
 * Downloads every file of the concert into the cache, skipping files already
 * downloaded and removing any stale ones first.
 *
 * expo-file-system has no web support, so on web the remote URLs are used directly.
 */
export async function downloadConcertAssets(concertCode: string = CONCERT_CODE): Promise<AssetUris> {
  if (Platform.OS === "web") {
    return Object.fromEntries(CONCERT_FILES.map((name) => [name, assetUrl(name, concertCode)]));
  }

  try {
    removeStaleAssets(concertCode);
  } catch (e) {
    // Leftover files only waste space, so don't let them block joining.
    console.warn("Couldn't remove stale concert files", e);
  }
  const folder = new Directory(concertsFolder(), concertCode);
  folder.create({ idempotent: true, intermediates: true });

  const entries = await Promise.all(
    CONCERT_FILES.map(async (name) => {
      const target = new File(folder, name);
      const file = target.exists ? target : await File.downloadFileAsync(assetUrl(name, concertCode), target);
      return [name, file.uri] as const;
    }),
  );
  return Object.fromEntries(entries);
}
