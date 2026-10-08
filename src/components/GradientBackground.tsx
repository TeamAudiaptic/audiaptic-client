import { Platform, View, type ViewProps } from "react-native";

/**
 * Design background (402x874 Figma frame) translated to CSS gradients.
 * Values are percentages of the frame so they scale with the screen.
 * Layers listed first are painted on top.
 */
const GRADIENT = [
  // Magenta glow, center-right
  "radial-gradient(ellipse 60.98% 60.98% at 58.54% 53.66%, rgba(194, 61, 140, 0.92) 0%, rgba(140, 64, 173, 0.42) 50%, rgba(46, 20, 77, 0) 100%)",
  // Teal glow, top-left
  "radial-gradient(ellipse 54.35% 54.35% at 8.7% -2.17%, rgba(20, 117, 133, 0.82) 0%, rgba(43, 61, 122, 0.36) 55%, rgba(31, 15, 61, 0) 100%)",
  // Base diagonal wash
  "linear-gradient(113.48deg, #1F0D40 0%, #4A1F6E 34.3%, #14334D 71.4%)",
].join(", ");

const gradientStyle = Platform.select({
  // react-native-web forwards plain CSS properties
  web: { backgroundImage: GRADIENT } as object,
  default: { experimental_backgroundImage: GRADIENT },
});

export function GradientBackground({ style, ...props }: ViewProps) {
  return (
    <View
      style={[{ backgroundColor: "#1F0D40" }, gradientStyle, style]}
      {...props}
    />
  );
}

