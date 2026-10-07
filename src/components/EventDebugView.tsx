/**
 * Text-only view of the processor, used to test it before the real outputs
 * (haptics, torch, screen color) are built.
 */

import { ScrollView, Text, View } from "react-native";

import type { ActiveEvents, LogEntry } from "@/lib/eventProcessor";
import { CHANNELS, type SessionEvent } from "@/lib/events";

/** e.g. "same-color-high-seq-wins (seq 7) #00FF00, 1500 ms", or "—" when idle. */
function describe(event: SessionEvent | null): string {
  if (!event) return "—";

  const details =
    event.type === "haptic" ? `intensity ${event.payload.intensity}`
    : event.type === "color" ? event.payload.color
    : `intensity ${event.payload.intensity ?? 1.0}${event.payload.transitionMs ? ` (${event.payload.transitionMs}ms fade)` : ""}`;

  return `${event.eventId} (seq ${event.sequence}) ${details}, ${event.payload.durationMs} ms`;
}

/** Unix ms → "HH:MM:SS.mmm" (UTC); milliseconds matter when checking timing. */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23);
}

/** One line per channel showing the event currently playing on it. */
export function ActiveEventList({ active }: { active: ActiveEvents }) {
  return (
    <View className="w-full gap-2">
      {CHANNELS.map((channel) => (
        <Text key={channel} className="text-base text-white">
          <Text className="font-bold">{channel}: </Text>
          {describe(active[channel])}
        </Text>
      ))}
    </View>
  );
}

/** Scrolling list of what happened to each event, newest at the top. */
export function EventLog({ entries }: { entries: LogEntry[] }) {
  return (
    <ScrollView className="w-full flex-1 rounded-xl bg-black/20 p-3">
      {entries.map((entry, index) => (
        <Text key={`${entry.at}-${index}`} className="font-mono text-xs text-white">
          {formatTime(entry.at)}  {entry.eventId}  {entry.outcome}
        </Text>
      ))}
    </ScrollView>
  );
}
