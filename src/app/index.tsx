import { View } from "react-native";
import { Button, Dialog, IconButton, Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveEventList, EventLog } from "@/components/EventDebugView";
import { GradientBackground } from "@/components/GradientBackground";
import { useEventProcessor } from "@/hooks/useEventProcessor";

// Placeholder session details until they come from the server.
const SESSION = { performer: "bla bla bla", description: "bla bla bla" };

export default function Index() {
  const { active, log, isJoined, join, leave } = useEventProcessor();
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground
      className="flex-1 gap-6 px-4 pb-8"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="items-end">
        <IconButton
          icon="menu"
          iconColor="white"
          size={36}
          accessibilityLabel="Menu"
          onPress={leave}
        />
      </View>

      <Portal>
        {/* The only way past this dialog is Enter: no Cancel, no tap-outside, no back button. */}
        <Dialog
          visible={!isJoined}
          dismissable={false}
          dismissableBackButton={false}
          // The design doesn't dim the background behind the dialog.
          theme={{ colors: { backdrop: "transparent" } }}
        >
          <Dialog.Title>Enter session</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Performer: {SESSION.performer}</Text>
            <Text variant="bodyMedium">Description: {SESSION.description}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={join}>Enter</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {isJoined && (
        <>
          <ActiveEventList active={active} />
          <EventLog entries={log} />
        </>
      )}
    </GradientBackground>
  );
}
