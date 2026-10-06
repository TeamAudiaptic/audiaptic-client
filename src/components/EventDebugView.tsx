import { ScrollView, Text, View } from "react-native";

import type { ActiveEvents, LogEntry } from "@/lib/eventProcessor";
import { CHANNELS, type SessionEvent } from "@/lib/events";

function describe(event: SessionEvent | null): string {
  if (!event) return "—";

  const details =
    event.type === "haptic" ? `intensity ${event.payload.intensity}`
    : event.type === "color" ? event.payload.color
    : "on";

  return `${event.eventId} (seq ${event.sequence}) ${details}, ${event.payload.durationMs} ms`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23);
}

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
