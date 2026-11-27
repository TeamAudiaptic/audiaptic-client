/**
 * Text-only debug views: the processor's log, for checking what happened to
 * each event while testing, and the clock sync status.
 */

import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";

import { lastSyncResult, subscribeToClock, timeSync } from "@/lib/clientTimeSync";
import type { LogEntry } from "@/lib/eventProcessor";

/** Unix ms → "HH:MM:SS.mmm" (UTC); milliseconds matter when checking timing. */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23);
}

/** Short scrolling list of what happened to each event, newest at the top. */
export function EventLog({ entries }: { entries: LogEntry[] }) {
  return (
    <ScrollView className="event-log">
      {entries.map((entry, index) => (
        <Text key={`${entry.at}-${index}`} className="event-log-line">
          {formatTime(entry.at)}  {entry.eventId}  {entry.outcome}
        </Text>
      ))}
    </ScrollView>
  );
}

/** How often the "last sync N s ago" text refreshes. */
const CLOCK_STATUS_REFRESH_MS = 1000;

/** The clock status line for the current moment. */
function describeClock(): string {
  const status = timeSync.status();
  const failure = lastSyncResult()?.reason;

  if (!status.synced) {
    return failure ? `Clock: not synced (${failure})` : "Clock: syncing…";
  }
  const sign = status.wallOffset >= 0 ? "+" : "";
  let text =
    `Clock: ${sign}${status.wallOffset.toFixed(1)} ms ±${status.error.toFixed(1)} ms, ` +
    `synced ${Math.round(status.age / 1000)} s ago`;
  if (failure) text += ` (last attempt failed)`;
  return text;
}

/**
 * One line describing the server clock offset, e.g.
 * "Clock: +132.4 ms ±3.1 ms, synced 12 s ago". Times in the log above are on
 * this clock, so they can be compared between phones.
 */
export function ClockStatus() {
  // The text is kept in state, not read from timeSync during render: the
  // React Compiler assumes render reads only props and state, so it would
  // compute the text once and show "syncing…" forever.
  const [text, setText] = useState(describeClock);

  // Refresh after every burst, and every second so the age stays current.
  useEffect(() => {
    const refresh = () => setText(describeClock());
    const interval = setInterval(refresh, CLOCK_STATUS_REFRESH_MS);
    const unsubscribe = subscribeToClock(refresh);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return <Text className="clock-status">{text}</Text>;
}
