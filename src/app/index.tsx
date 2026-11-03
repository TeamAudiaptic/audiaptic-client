import { Image } from "expo-image";
import { cssInterop } from "nativewind";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { EventLog } from "@/components/EventDebugView";
import { TorchController } from "@/components/TorchController";
import { VideoOutput } from "@/components/VideoOutput";
import { useAudioOutput } from "@/hooks/useAudioOutput";
import { useEventProcessor } from "@/hooks/useEventProcessor";
import { useTorchTransition } from "@/hooks/useTorchTransition";
import type { LogEntry } from "@/lib/eventProcessor";
import { getBackgroundColor } from "@/lib/outputs/colorEvent";
import { getImage } from "@/lib/outputs/imageEvent";

// Styles live in src/styles/*.css. expo-image isn't a core component, so
// NativeWind has to be told to turn its className into a style.
cssInterop(Image, { className: "style" });

/** ActivityIndicator takes a color prop, not a class; matches .join-button-text. */
const SPINNER_COLOR = "#ffffff";

/**
 * One screen with two views: the code entry (until joined) and the concert
 * itself. The processor hook stays here so leaving the concert view doesn't
 * lose its state.
 */
export default function Index() {
  const { active, log, status, isJoined, error, assets, join, leave } = useEventProcessor();
  const torchState = useTorchTransition(active.torch, isJoined);
  // Called before the early return: hooks must run on every render.
  useAudioOutput(active.audio, assets);

  if (!isJoined) {
    return <JoinView onJoin={join} error={error} isDownloading={status === "downloading"} />;
  }

  // The one style that can't live in CSS: the color comes from the event at runtime.
  const eventColor = getBackgroundColor(active.color);

  return (
    <View
      className="concert-screen"
      style={eventColor ? { backgroundColor: eventColor } : undefined}
    >
      <TorchController torchState={torchState} />
      <ConcertView image={getImage(active.image, assets)} log={log} onLeave={leave} />
      {/* Last, so the full-screen video draws on top of everything else. */}
      <VideoOutput videoEvent={active.video} assets={assets} />
    </View>
  );
}

interface JoinViewProps {
  onJoin: (code: string) => void;
  error: string | null;
  isDownloading: boolean;
}

/** Kahoot-style home: only a code box and a button, centered. */
function JoinView({ onJoin, error, isDownloading }: JoinViewProps) {
  const [code, setCode] = useState("");
  const submit = () => {
    if (!isDownloading) onJoin(code);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="join-screen"
    >
      <Text className="join-title">Audiaptic</Text>

      <View className="join-card">
        <Text nativeID="concert-code-label" className="join-label">
          Concert code
        </Text>
        <TextInput
          accessibilityLabelledBy="concert-code-label"
          value={code}
          onChangeText={setCode}
          onSubmitEditing={submit}
          editable={!isDownloading}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          placeholder="e.g. concert-1"
          className="join-input"
        />
        <Pressable
          accessibilityRole="button"
          disabled={isDownloading}
          onPress={submit}
          className="join-button"
        >
          {isDownloading && <ActivityIndicator color={SPINNER_COLOR} />}
          <Text className="join-button-text">
            {isDownloading ? "Downloading files…" : "Enter"}
          </Text>
        </Pressable>
      </View>

      {error && <Text className="join-error">{error}</Text>}
    </KeyboardAvoidingView>
  );
}

interface ConcertViewProps {
  image: ReturnType<typeof getImage>;
  log: LogEntry[];
  onLeave: () => void;
}

/** Shown while joined: the image area, a short log and a Leave button. */
function ConcertView({ image, log, onLeave }: ConcertViewProps) {
  return (
    <View className="concert-content">
      <View className="image-frame">
        {image ? (
          <Image
            source={{ uri: image.uri }}
            transition={image.transitionMs}
            contentFit="contain"
            className="image-frame-image"
          />
        ) : (
          <Text className="image-frame-placeholder">No image showing</Text>
        )}
      </View>

      <EventLog entries={log} />

      <Pressable accessibilityRole="button" onPress={onLeave} className="leave-button">
        <Text className="leave-button-text">Leave Event</Text>
      </Pressable>
    </View>
  );
}
