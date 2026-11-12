#!/usr/bin/env node
/**
 * Plays data/testSession.json through the server, as if Max were performing.
 *
 * Connects to the server's performer socket and sends each event at its
 * (re-timed) send time. The server validates it, answers with an ack, and
 * relays it to every phone connected to /api/audience/{code}.
 *
 *   npm run send-test                       # server from EXPO_PUBLIC_SERVER_URL (.env), start in 5 s
 *   npm run send-test -- --delay 10000      # more time to press Enter on the phone
 *   npm run send-test -- --url ws://localhost/api/performer   # through Caddy
 *   npm run send-test -- --docs             # send the docs' timestamp fields instead
 *
 * Timing: the file's timestamps are fixed dates, so they're shifted to start
 * `--delay` ms from now, keeping the spacing between events.
 *
 * Formats:
 *   default  What the server accepts today: a required `execTimestamp` (the
 *            absolute time to play) and `sentTimestamp`, and nothing else. Its
 *            schema is strict, so the docs' `epochTimestamp` is rejected.
 *   --docs   The envelope from the docs (`epochTimestamp` / `relativeTimestamp`).
 *            Use once the server is updated to match.
 *
 * Every run adds a suffix to each eventId, so a phone that stays joined
 * doesn't drop a second run as duplicates.
 *
 * Needs Node 22+ (built-in WebSocket).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const options = parseArgs(process.argv.slice(2), {
  url: defaultPerformerUrl(),
  delay: "5000",
  file: resolve(HERE, "../data/testSession.json"),
  docs: false,
});
const startDelayMs = Number(options.delay);
/** How long to wait for the last acks before closing. */
const ACK_GRACE_MS = 2000;
/** Send-ahead used when an event has no sentTimestamp. */
const DEFAULT_LEAD_MS = 500;

if (typeof WebSocket === "undefined") {
  fail("This script needs Node 22 or newer (for the built-in WebSocket).");
}

const events = JSON.parse(readFileSync(options.file, "utf8"));
const runId = Date.now().toString(36);
const plan = planEvents(events, Date.now() + startDelayMs);

console.log(`Connecting to ${options.url} …`);
const socket = new WebSocket(options.url);
const typeById = new Map();
const acks = { ok: 0, rejected: 0 };
let sent = 0;
let finished = false;

socket.addEventListener("open", () => {
  console.log(
    `Connected. Sending ${plan.length} events in ${options.docs ? "docs" : "server"} format; ` +
      `the first plays in ${(startDelayMs / 1000).toFixed(1)} s. Join on the phone now.\n`,
  );
  for (const step of plan) {
    setTimeout(() => send(step), Math.max(0, step.sendAt - Date.now()));
  }
});

socket.addEventListener("message", (message) => {
  let ack;
  try {
    ack = JSON.parse(String(message.data));
  } catch {
    console.log(`  ? ${message.data}`);
    return;
  }
  const type = typeById.get(ack.eventId) ?? "?";
  if (ack.status === 200 || ack.status === 202) {
    acks.ok += 1;
    console.log(`  ✓ ${ack.status} ${type.padEnd(6)} ${ack.eventId}${ack.status === 202 ? " (relayed)" : ""}`);
  } else {
    acks.rejected += 1;
    console.log(`  ✗ ${ack.status} ${type.padEnd(6)} ${ack.eventId}: ${(ack.error ?? []).join(" | ")}`);
  }
  if (sent === plan.length && acks.ok + acks.rejected >= plan.length) finish();
});

socket.addEventListener("error", () => {
  if (!finished) {
    fail(
      `Couldn't connect to ${options.url}. Is the server running? ` +
        "(docker compose up in audiaptic-server, or see its README)",
    );
  }
});

socket.addEventListener("close", (event) => {
  if (!finished) fail(`The server closed the connection (code ${event.code}).`);
});

function send(step) {
  const message = options.docs ? toDocsFormat(step) : toServerFormat(step);
  typeById.set(message.eventId, message.type);
  socket.send(JSON.stringify(message));
  sent += 1;
  const when = step.execAt - Date.now();
  console.log(`→ ${message.type.padEnd(6)} ${message.eventId} (plays in ${when} ms)`);
  if (sent === plan.length) setTimeout(finish, ACK_GRACE_MS);
}

/**
 * Works out, for every event, when it plays (`execAt`) and when to send it
 * (`sendAt`), with the earliest epoch timestamp moved to `startAt`.
 */
function planEvents(fileEvents, startAt) {
  const epochs = fileEvents.map((event) => event.epochTimestamp).filter(Boolean);
  const offset = epochs.length ? startAt - Math.min(...epochs) : 0;

  const start = fileEvents.find((event) => event.type === "start");
  const fileStart = start?.epochTimestamp || null;
  const startTime = fileStart ? fileStart + offset : startAt;

  return fileEvents
    .map((event) => {
      // When the event plays, both in the file's dates and in this run.
      const fileExec = event.epochTimestamp || (event.relativeTimestamp && fileStart ? fileStart + event.relativeTimestamp : null);
      const execAt = event.epochTimestamp
        ? event.epochTimestamp + offset
        : event.relativeTimestamp
          ? startTime + event.relativeTimestamp
          : startAt;
      const lead = fileExec && event.sentTimestamp ? fileExec - event.sentTimestamp : DEFAULT_LEAD_MS;
      return { event, execAt, sendAt: execAt - lead };
    })
    .sort((a, b) => a.sendAt - b.sendAt || a.event.sequence - b.event.sequence);
}

/** What the server's validator accepts today (strict: no extra fields). */
function toServerFormat({ event, execAt }) {
  return {
    schemaVersion: event.schemaVersion,
    eventId: `${event.eventId}-${runId}`,
    sequence: event.sequence,
    type: event.type,
    sentTimestamp: Date.now(),
    execTimestamp: execAt,
    payload: event.payload ?? {},
  };
}

/** The envelope from audiaptic-docs (shared-envelope.mdx). */
function toDocsFormat({ event, execAt }) {
  const { epochTimestamp, execTimestamp, ...rest } = event;
  return {
    ...rest,
    eventId: `${event.eventId}-${runId}`,
    sentTimestamp: Date.now(),
    ...(epochTimestamp ? { epochTimestamp: execAt } : {}),
  };
}

function finish() {
  if (finished) return;
  finished = true;
  const missing = plan.length - acks.ok - acks.rejected;
  console.log(
    `\nDone: ${acks.ok} accepted, ${acks.rejected} rejected` +
      (missing > 0 ? `, ${missing} without an ack` : "") +
      ".",
  );
  socket.close();
}

/**
 * The performer socket on the same server the app uses (EXPO_PUBLIC_SERVER_URL),
 * so the address only has to change in one place. Reads it from the shell, then
 * .env.local, then .env, the same priority Expo uses (loadEnvFile never
 * overwrites a variable that's already set).
 * 10.0.2.2 is the Android emulator's name for this computer; from here that's localhost.
 */
function defaultPerformerUrl() {
  for (const file of ["../.env.local", "../.env"]) {
    try {
      process.loadEnvFile(resolve(HERE, file));
    } catch {
      // The file is optional.
    }
  }
  const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;
  if (!serverUrl) {
    fail("EXPO_PUBLIC_SERVER_URL is not set. Copy .env.example to .env and set it, or pass --url.");
  }
  const server = serverUrl.replace("//10.0.2.2", "//localhost").replace(/\/+$/, "");
  return `${server}/api/performer`;
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

/** Minimal `--name value` / `--flag` parser; unknown options are an error. */
function parseArgs(args, defaults) {
  const result = { ...defaults };
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, "");
    if (!(name in defaults)) fail(`Unknown option ${args[i]}. Options: ${Object.keys(defaults).map((key) => `--${key}`).join(", ")}`);
    if (typeof defaults[name] === "boolean") result[name] = true;
    else result[name] = args[++i];
  }
  return result;
}
