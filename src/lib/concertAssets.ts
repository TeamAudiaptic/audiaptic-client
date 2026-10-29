/**
 * Finding and downloading a concert's files.
 *
 * Files live in a public R2 bucket under a folder named after the concert code:
 *
 *   https://pub-....r2.dev/concert-1/12in-Vinyl-LP-Record-Angle.jpg
 *   └──── ASSET_BASE_URL ───┘ └code─┘ └──────── file name ─────────┘
 *
 * The bucket can't list its own contents, so every concert folder has an
 * index.json naming its files: { "files": ["a.jpg", "b.mp3", ...] }.
 * A code is valid when that index exists. On join, every listed file is
 * downloaded to the device's cache so events can play it without waiting on
 * the network.
 */

import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/** Everything before the concert code; the same for every concert. */
export const ASSET_BASE_URL = "https://pub-c69c5d6678254b90a1f1cac88377e860.r2.dev";

/** Thrown when no concert exists for the code the user typed. */
export class InvalidConcertCodeError extends Error {
  constructor(code: string) {
    super(`No concert found for code "${code}"`);
    this.name = "InvalidConcertCodeError";
  }
}

/** File name (an event's `assetAlias`) → URI the app can load it from. */
export type AssetUris = Record<string, string>;

/** Download URL for one of a concert's files. */
export function assetUrl(concertCode: string, fileName: string): string {
  return `${ASSET_BASE_URL}/${encodeURIComponent(concertCode)}/${encodeURIComponent(fileName)}`;
}

/** Codes are folder names, so anything else (empty, slashes, spaces) can't be a concert. */
function looksLikeConcertCode(code: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(code);
}

/**
 * Reads the concert's index.json and returns the file names it lists.
 *
 * @throws InvalidConcertCodeError if there's no concert with this code.
 */
export async function fetchConcertFiles(concertCode: string): Promise<string[]> {
  if (!looksLikeConcertCode(concertCode)) throw new InvalidConcertCodeError(concertCode);

  // no-cache: the file list can change between performances.
  const response = await fetch(assetUrl(concertCode, "index.json"), {
    headers: { "Cache-Control": "no-cache" },
  });
  if (response.status === 404) throw new InvalidConcertCodeError(concertCode);
  if (!response.ok) throw new Error(`index.json request failed with HTTP ${response.status}`);

  const index: unknown = await response.json();
  const files = (index as { files?: unknown } | null)?.files;
  if (!Array.isArray(files) || !files.every(isPlainFileName)) {
    throw new Error('index.json must look like { "files": ["name.ext", ...] }');
  }
  return files;
}

/**
 * File names become paths on the device, so only allow a bare name: no
 * folders and no "..", which could point outside the concert's folder.
 */
function isPlainFileName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name !== "" &&
    name !== "." &&
    name !== ".." &&
    !/[/\\]/.test(name)
  );
}

/** Holds one folder per concert. A function, as expo-file-system can't be touched on web. */
function concertsFolder() {
  return new Directory(Paths.cache, "concerts");
}

/**
 * Deletes everything in the concerts folder except this concert's listed
 * files, e.g. files from another concert, files no longer in its index, or
 * files from an app run that was closed without pressing Leave.
 */
function removeStaleAssets(concertCode: string, files: string[]) {
  const root = concertsFolder();
  if (!root.exists) return;

  for (const entry of root.list()) {
    if (entry.name !== concertCode || !(entry instanceof Directory)) {
      entry.delete();
      continue;
    }
    for (const file of entry.list()) {
      if (!files.includes(file.name)) file.delete();
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
 * Looks up the concert's files in its index.json and downloads them into the
 * cache, skipping files already downloaded and removing any stale ones first.
 *
 * expo-file-system has no web support, so on web the remote URLs are used directly.
 *
 * @throws InvalidConcertCodeError if there's no concert with this code.
 */
export async function downloadConcertAssets(concertCode: string): Promise<AssetUris> {
  const files = await fetchConcertFiles(concertCode);

  if (Platform.OS === "web") {
    return Object.fromEntries(files.map((name) => [name, assetUrl(concertCode, name)]));
  }

  try {
    removeStaleAssets(concertCode, files);
  } catch (e) {
    // Leftover files only waste space, so don't let them block joining.
    console.warn("Couldn't remove stale concert files", e);
  }
  const folder = new Directory(concertsFolder(), concertCode);
  folder.create({ idempotent: true, intermediates: true });

  const entries = await Promise.all(
    files.map(async (name) => {
      const target = new File(folder, name);
      const file = target.exists
        ? target
        : await File.downloadFileAsync(assetUrl(concertCode, name), target);
      return [name, file.uri] as const;
    }),
  );
  return Object.fromEntries(entries);
}
