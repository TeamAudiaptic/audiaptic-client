/**
 * Video output: plays the active video event's downloaded file full-screen,
 * on top of the concert screen.
 *
 * Each video event gets its own player (the clip is keyed by eventId), so a
 * new event always starts fresh and the old player is released.
 */

import { useEventListener } from "expo";
import { type VideoPlayer, VideoView, useVideoPlayer } from "expo-video";
import { cssInterop } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import type { AssetUris } from "@/lib/concertAssets";
import type { SessionEvent, VideoPayload } from "@/lib/events";

// Styles live in src/styles/video.css. VideoView and Animated.View aren't
// plain core components, so NativeWind has to be told to map className.
cssInterop(VideoView, { className: "style" });
cssInterop(Animated.View, { className: "style" });

interface VideoOutputProps {
  videoEvent: SessionEvent | null;
  assets: AssetUris;
}

export function VideoOutput({ videoEvent, assets }: VideoOutputProps) {
  if (videoEvent?.type !== "video") return null;
  const uri = assets[videoEvent.payload.assetAlias];
  if (!uri) return null;

  return <VideoClip key={videoEvent.eventId} uri={uri} payload={videoEvent.payload} />;
}

/**
 * Seeks to `startOffsetMs` and plays. Kept outside the component: React's
 * lint rules don't allow changing a hook's returned object in component code.
 */
function playFrom(player: VideoPlayer, startOffsetMs: number, loop: boolean) {
  player.loop = loop;
  player.currentTime = startOffsetMs / 1000;
  player.play();
}

function VideoClip({ uri, payload }: { uri: string; payload: VideoPayload }) {
  const { startOffsetMs = 0, durationMs, loop = false, transitionMs = 0 } = payload;
  const [hasEnded, setHasEnded] = useState(false);
  const replays = useRef(0);
  // useState, not useRef: the value is created once and read during render.
  const [opacity] = useState(() => new Animated.Value(transitionMs > 0 ? 0 : 1));

  // With a duration, looping repeats until the processor ends the event.
  const player = useVideoPlayer(uri, (newPlayer) =>
    playFrom(newPlayer, startOffsetMs, loop && !!durationMs),
  );

  useEventListener(player, "playToEnd", () => {
    // The docs: "If duration is missing, loops once", i.e. one extra play-through.
    if (loop && !durationMs && replays.current === 0) {
      replays.current += 1;
      playFrom(player, startOffsetMs, false);
      return;
    }
    // Finished before (or without) a duration: stop covering the screen.
    setHasEnded(true);
  });

  useEffect(() => {
    if (transitionMs <= 0) return;
    Animated.timing(opacity, { toValue: 1, duration: transitionMs, useNativeDriver: true }).start();
  }, [opacity, transitionMs]);

  if (hasEnded) return null;

  return (
    // The one style that can't live in CSS: opacity is animated at runtime.
    <Animated.View className="video-overlay" style={{ opacity }}>
      <VideoView player={player} nativeControls={false} contentFit="contain" className="video-view" />
    </Animated.View>
  );
}
