/**
 * Settings card opened from the hamburger menu. Changes are kept as a draft
 * and only handed back to the parent when the user presses Save.
 */

import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { StepSlider } from "@/components/StepSlider";

export type Settings = { setting1: number; setting2: number };

export const DEFAULT_SETTINGS: Settings = { setting1: 5, setting2: 5 };

function SettingLabel({ name, description }: { name: string; description: string }) {
  return (
    <Text variant="bodyLarge">
      {name} <Text variant="bodyLarge" style={{ fontStyle: "italic" }}>[{description}]</Text>
    </Text>
  );
}

type Props = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(initial);

  return (
    <View
      className="flex-1 overflow-hidden rounded-[28px]"
      style={{ backgroundColor: colors.elevation.level3 }}
    >
      <ScrollView contentContainerClassName="flex-grow gap-4 px-9 pb-10 pt-12">
        <View className="gap-2">
          <Text variant="displaySmall">Settings</Text>
          <Text variant="bodySmall" style={{ fontStyle: "italic" }}>
            [description of settings]
          </Text>
        </View>

        <View className="mt-6 gap-1">
          <SettingLabel name="Setting 1" description="description of setting" />
          <StepSlider
            centered
            accessibilityLabel="Setting 1"
            value={draft.setting1}
            onValueChange={(setting1) => setDraft((d) => ({ ...d, setting1 }))}
          />
        </View>

        <View className="gap-1">
          <SettingLabel name="Setting 2" description="description of setting" />
          <StepSlider
            centered
            accessibilityLabel="Setting 2"
            value={draft.setting2}
            onValueChange={(setting2) => setDraft((d) => ({ ...d, setting2 }))}
          />
        </View>

        <View className="flex-1 items-center justify-center py-10">
          <Text variant="labelMedium" style={{ fontStyle: "italic" }}>
            [more settings if needed]
          </Text>
        </View>

        <Button
          mode="elevated"
          buttonColor={colors.secondaryContainer}
          textColor={colors.onSecondaryContainer}
          onPress={() => onSave(draft)}
          style={{ alignSelf: "center", borderRadius: 12 }}
          contentStyle={{ height: 64, paddingHorizontal: 20 }}
        >
          Save
        </Button>
      </ScrollView>
    </View>
  );
}

