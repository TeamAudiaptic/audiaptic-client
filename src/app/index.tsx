import { Pressable, Text, View } from "react-native";

import { ActiveEventList, EventLog } from "@/components/EventDebugView";
import { useEventProcessor } from "@/hooks/useEventProcessor";
import { getBackgroundColor } from "@/lib/outputs/colorEvent";

/** Shown when no color event is playing (Tailwind's teal-500). */
const DEFAULT_BACKGROUND = "#14B8A6";

export default function Index() {
  const { active, log, isJoined, join, leave } = useEventProcessor();
  const backgroundColor = getBackgroundColor(active.color) ?? DEFAULT_BACKGROUND;

  return (
    <View
      className="flex-1 items-center gap-6 px-4 pb-8 pt-20"
      style={{ backgroundColor }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={isJoined ? leave : join}
        className="rounded-full bg-white px-8 py-4 active:opacity-70"
      >
        <Text className="text-lg font-bold text-teal-600">
          {isJoined ? "Leave Event" : "Join Event"}
        </Text>
      </Pressable>

      <ActiveEventList active={active} />
      <EventLog entries={log} />
    </View>
  );
}
