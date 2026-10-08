import { Pressable, Text } from "react-native";

import { ActiveEventList, EventLog } from "@/components/EventDebugView";
import { GradientBackground } from "@/components/GradientBackground";
import { useEventProcessor } from "@/hooks/useEventProcessor";

export default function Index() {
  const { active, log, isJoined, join, leave } = useEventProcessor();

  return (
    <GradientBackground className="flex-1 items-center gap-6 px-4 pb-8 pt-20">
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
    </GradientBackground>
  );
}
