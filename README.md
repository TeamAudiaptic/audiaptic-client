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

2. Create your `.env` from the template, then set your server address (see [Configuration](#configuration))

   ```bash
   cp .env.example .env
   ```

3. Start the dev server

   ```bash
   npx expo start
   ```

4. Open the app using one of:
   - **Expo Go** — scan the QR code with your phone
   - **iOS Simulator** — press `i` in the terminal
   - **Android Emulator** — press `a` in the terminal

## Configuration

The API server's address is set by an environment variable:

| Variable | Description | Example |
|---|---|---|
| `EXPO_PUBLIC_SERVER_URL` | Base URL of the API server, with no path | `ws://192.168.1.42:3000` |

Set it in a **`.env`** file in the project root. `.env` is gitignored, so each person keeps their own copy. Start from the committed template, [`.env.example`](.env.example):

```bash
cp .env.example .env
```

```bash
EXPO_PUBLIC_SERVER_URL=ws://192.168.1.42:3000
```

If you add a new variable, add it to `.env.example` too so others know to set it. Don't commit `.env`.

- **Server on another computer on the same Wi-Fi:** use that computer's IP, e.g. `ws://192.168.1.42:3000`. This works from phones and the emulator.
- **Server on this computer:** `ws://10.0.2.2:3000` works from the Android emulator only.

After changing the value, reload the app (press `r` in the terminal). You don't need to restart the dev server. `npm run send-test` reads the same variable.

> The value is built into the app bundle, so anyone with the app can read it. Never put secrets in `EXPO_PUBLIC_` variables.

Concert codes, the asset base URL, and the event source (`server` or `testFile`) are still in [`data/concertCode.json`](data/concertCode.json).

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
| `npm run send-test` | Play `data/testSession.json` through the server at `EXPO_PUBLIC_SERVER_URL` |
| `npx expo lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check without emitting |

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [NativeWind (Tailwind for RN)](https://www.nativewind.dev/)
