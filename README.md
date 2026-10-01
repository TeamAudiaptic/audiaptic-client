# Audiaptic

An [Expo](https://expo.dev) mobile app built with React Native, NativeWind (Tailwind CSS), and Expo Router.

## Prerequisites

- **Node.js** (v18 or later) — [download](https://nodejs.org/)

That's all you need to get started. The app runs in [Expo Go](https://expo.dev/go) on your phone — no Xcode or Android Studio required.

> **Optional:** To run on the iOS Simulator, install [Xcode](https://developer.apple.com/xcode/). For the Android Emulator, install [Android Studio](https://developer.android.com/studio). See [Set up your environment](https://docs.expo.dev/get-started/set-up-your-environment/) for details.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the dev server

   ```bash
   npx expo start
   ```

3. Open the app using one of:
   - **Expo Go** — scan the QR code with your phone
   - **iOS Simulator** — press `i` in the terminal
   - **Android Emulator** — press `a` in the terminal

## Project structure

Routes live in **`src/app/`** — every file is a screen, `_layout.tsx` files define navigators. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

```
src/
  app/
    _layout.tsx   # root navigator (Stack)
    index.tsx     # home screen
  global.css      # Tailwind CSS entry
```

## Scripts

| Command | Description |
|---|---|
| `npx expo start` | Start the dev server |
| `npx expo start --clear` | Start with a fresh Metro cache |
| `npx expo lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check without emitting |

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [NativeWind (Tailwind for RN)](https://www.nativewind.dev/)
