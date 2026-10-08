/**
 * Material 3 slider with discrete stops: a rounded track split by a
 * vertical handle bar, with a dot at every step (react-native-paper has no slider).
 */

import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "react-native-paper";

// MD3 slider measurements (dp).
const TRACK_HEIGHT = 16;
const HANDLE_WIDTH = 4;
const HANDLE_HEIGHT = 44;
const HANDLE_GAP = 6; // space between the handle and the track on each side
const DOT_SIZE = 4;
const INNER_RADIUS = 2; // track corners next to the handle or the center
// The first and last stops sit inside the track's rounded ends.
const INSET = TRACK_HEIGHT / 2;

type Props = {
  value: number;
  onValueChange: (value: number) => void;
  /** Number of steps; values go from 0 to `steps`. */
  steps?: number;
  /**
   * MD3 "centered" slider: the active (filled) track runs from the middle to
   * the handle instead of from the start. At the middle value nothing is filled.
   */
  centered?: boolean;
  accessibilityLabel?: string;
};

export function StepSlider({
  value,
  onValueChange,
  steps = 10,
  centered = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const span = Math.max(0, width - INSET * 2);
  const xForValue = (v: number) => INSET + (v / steps) * span;

  // The gesture is rebuilt each render, so this always sees current props.
  const setFromX = (x: number) => {
    if (span <= 0) return;
    const next = Math.round(((x - INSET) / span) * steps);
    onValueChange(Math.min(steps, Math.max(0, next)));
  };

  // minDistance(0) makes a plain tap move the handle too.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) => setFromX(event.x))
    .onUpdate((event) => setFromX(event.x));

  const origin = centered ? steps / 2 : 0;
  const handleX = xForValue(value);
  const originX = centered ? xForValue(origin) : 0;
  const trackTop = (HANDLE_HEIGHT - TRACK_HEIGHT) / 2;
  const leftEnd = handleX - HANDLE_WIDTH / 2 - HANDLE_GAP; // track left of the handle ends here
  const rightStart = handleX + HANDLE_WIDTH / 2 + HANDLE_GAP; // track right of the handle starts here

  // Filled section between the origin and the handle (empty when they meet).
  const active =
    value > origin ? { left: originX, right: leftEnd }
    : value < origin ? { left: rightStart, right: originX }
    : null;
  const isActiveStep = (step: number) =>
    (step >= origin && step < value) || (step <= origin && step > value);

  const segment = (
    left: number,
    right: number,
    color: string,
    leftRadius: number,
    rightRadius: number,
  ) =>
    right > left && (
      <View
        style={{
          position: "absolute",
          top: trackTop,
          left,
          width: right - left,
          height: TRACK_HEIGHT,
          backgroundColor: color,
          borderTopLeftRadius: leftRadius,
          borderBottomLeftRadius: leftRadius,
          borderTopRightRadius: rightRadius,
          borderBottomRightRadius: rightRadius,
        }}
      />
    );

  const OUTER = TRACK_HEIGHT / 2;

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: HANDLE_HEIGHT }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: steps, now: value }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
          onValueChange(Math.min(steps, Math.max(0, value + delta)));
        }}
      >
        {width > 0 && (
          <>
            {/* Inactive track on both sides of the handle */}
            {segment(0, leftEnd, colors.secondaryContainer, OUTER, INNER_RADIUS)}
            {segment(rightStart, width, colors.secondaryContainer, INNER_RADIUS, OUTER)}

            {/* Active track, drawn on top */}
            {active &&
              segment(
                active.left,
                active.right,
                colors.primary,
                active.left <= 0 ? OUTER : INNER_RADIUS,
                active.right >= width ? OUTER : INNER_RADIUS,
              )}

            {/* Stop dots, hidden where the handle and its gap cover them */}
            {Array.from({ length: steps + 1 }, (_, step) => {
              const x = xForValue(step);
              if (x > leftEnd - DOT_SIZE && x < rightStart + DOT_SIZE) return null;
              return (
                <View
                  key={step}
                  style={{
                    position: "absolute",
                    top: (HANDLE_HEIGHT - DOT_SIZE) / 2,
                    left: x - DOT_SIZE / 2,
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: DOT_SIZE / 2,
                    backgroundColor: isActiveStep(step)
                      ? colors.onPrimary
                      : colors.onSecondaryContainer,
                  }}
                />
              );
            })}

            {/* Handle */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: handleX - HANDLE_WIDTH / 2,
                width: HANDLE_WIDTH,
                height: HANDLE_HEIGHT,
                borderRadius: HANDLE_WIDTH / 2,
                backgroundColor: colors.primary,
              }}
            />
          </>
        )}
      </View>
    </GestureDetector>
  );
}
