import { Platform, View, type ViewProps } from "react-native";

/**
 * Design background (402x874 Figma frame) translated to a CSS gradient.
 * The SVG also defines two radial glows, but its opaque linear layer is
 * painted over them, so only the linear gradient is visible in the design.
 */
const GRADIENT =
  "linear-gradient(113.48deg, #1F0D40 0%, #4A1F6E 34.3%, #14334D 71.4%)";

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

