/**
 * Text-only view of the processor's log, for checking what happened to each
 * event while testing.
 */

import { ScrollView, Text } from "react-native";

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
