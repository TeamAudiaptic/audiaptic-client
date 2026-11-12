/**
 * Live event source: connects to the server's audience socket and hands every
 * event it receives to the processor.
 *
 *   Max ──► /api/performer ──► server ──► /api/audience/{code} ──► here ──► processor.receive()
 *
 * The server URL comes from EXPO_PUBLIC_SERVER_URL in .env (copy .env.example);
 * which source to use comes from data/concertCode.json.
 * A dropped connection is retried after 1 s, 2 s, 4 s … (at most 10 s apart).
 * The processor ignores events it already has, so a resent event can't play twice.
 */

import config from "../../data/concertCode.json";
import type { EventProcessor } from "./eventProcessor";

/**
 * Base URL of the API server, without a path, e.g. "ws://192.168.1.42:3000"
 * for a server on another computer on the same Wi-Fi (works from the emulator
 * and from phones). For a server on the computer running the emulator,
 * "ws://10.0.2.2:3000" also works, but only from the emulator.
 *
 * Set by EXPO_PUBLIC_SERVER_URL. Expo inlines it at bundle time, so it must be
 * read as `process.env.EXPO_PUBLIC_SERVER_URL` exactly (no destructuring).
 */
export const SERVER_URL: string = (process.env.EXPO_PUBLIC_SERVER_URL ?? "").replace(/\/+$/, "");

if (!SERVER_URL) {
  console.error(
    "EXPO_PUBLIC_SERVER_URL is not set. Copy .env.example to .env, set it, then reload the app.",
  );
}

/** "server" listens to the audience socket; "testFile" replays data/testSession.json locally. */
export const EVENT_SOURCE: "server" | "testFile" =
  config.eventSource === "testFile" ? "testFile" : "server";

/** Close code the server sends for an unknown join code (audience.route.ts). */
const INVALID_CODE_CLOSE = 4404;

const FIRST_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10_000;

export type ConnectionState = "connecting" | "connected" | "reconnecting";

interface ServerSessionCallbacks {
  onStateChange: (state: ConnectionState) => void;
  /** The server rejected the join code. The session has already stopped. */
  onInvalidCode: () => void;
}

/**
 * Connects to the audience socket for `code` and keeps it connected until
 * `stop()` is called.
 *
 * @returns `stop()`, which closes the socket and cancels any retry.
 */
export function startServerSession(
  processor: EventProcessor,
  code: string,
  { onStateChange, onInvalidCode }: ServerSessionCallbacks,
) {
  const url = `${SERVER_URL}/api/audience/${encodeURIComponent(code)}`;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = FIRST_RETRY_DELAY_MS;
  let stopped = false;

  function connect() {
    socket = new WebSocket(url);

    socket.onopen = () => {
      retryDelay = FIRST_RETRY_DELAY_MS;
      onStateChange("connected");
    };

    socket.onmessage = (message) => {
      let event: unknown = null;
      try {
        event = JSON.parse(String(message.data));
      } catch {
        // Not JSON: passing null makes the processor log it as invalid.
      }
      processor.receive(event);
    };

    // An error is always followed by a close, which handles the retry.
    socket.onclose = (event) => {
      socket = null;
      if (stopped) return;

      if (event.code === INVALID_CODE_CLOSE) {
        stopped = true;
        onInvalidCode();
        return;
      }
      onStateChange("reconnecting");
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    };
  }

  onStateChange("connecting");
  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    },
  };
}
