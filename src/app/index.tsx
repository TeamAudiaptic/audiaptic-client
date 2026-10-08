import { useState } from "react";
import { View } from "react-native";
import { Button, Dialog, IconButton, Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveEventList, EventLog } from "@/components/EventDebugView";
import { GradientBackground } from "@/components/GradientBackground";
import { DEFAULT_SETTINGS, SettingsPanel, type Settings } from "@/components/SettingsPanel";
import { useEventProcessor } from "@/hooks/useEventProcessor";

// Placeholder session details until they come from the server.
const SESSION = { performer: "bla bla bla", description: "bla bla bla" };

export default function Index() {
  const { active, log, isJoined, join } = useEventProcessor();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const saveSettings = (next: Settings) => {
    setSettings(next);
    setSettingsOpen(false);
  };

  return (
    <GradientBackground
      className="flex-1 gap-2 px-5"
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 72 }}
    >
      <View className="items-end">
        <IconButton
          icon="menu"
          iconColor="white"
          size={36}
          accessibilityLabel={settingsOpen ? "Close settings" : "Open settings"}
          onPress={() => setSettingsOpen((open) => !open)}
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

      {settingsOpen ? (
        <SettingsPanel initial={settings} onSave={saveSettings} />
      ) : (
        isJoined && (
          <View className="flex-1 gap-6">
            <ActiveEventList active={active} />
            <EventLog entries={log} />
          </View>
        )
      )}
    </GradientBackground>
  );
}
