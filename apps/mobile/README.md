# LabLens Mobile

React Native + Expo + TypeScript app for LabLens. Runs entirely on the device:
terminology/reference data, observations, interpretation and OCR are all local —
no external services are used at runtime.

## Stack

- **Expo SDK 57** (React Native 0.86, React 19, New Architecture)
- **expo-sqlite** + **Drizzle** (`drizzle-orm/expo-sqlite`) for persistence
- **PaddleOCR** on-device via `ppu-paddle-ocr/mobile`
  (onnxruntime-react-native + `@shopify/react-native-skia`)
- **React Navigation** (native stack + bottom tabs)
- **react-native-svg** for charts

The app reuses the shared packages without any runtime-specific business logic
duplication:

```
@lablens/core          domain types, services, repository interfaces (pure)
@lablens/data          shared Drizzle schema + repositories + composition
@lablens/data/expo     expo-sqlite driver (this app)
@lablens/ocr/portable  extraction, parsing, matching (no Node-only engines)
```

The mobile app only provides: the `expo-sqlite` driver handle, the on-device
`PaddleMobileEngine` (`OcrEngine`), UI preferences (`SettingsStore`), and the
React Native screens.

## Requirements

Both `onnxruntime-react-native` and `@shopify/react-native-skia` ship native
modules, so the app requires a **development build** (Expo Dev Client) or a
release build via `expo prebuild` — it does **not** run in Expo Go.

- Android SDK / Xcode as appropriate
- Node 22+ (for `expo` CLI)

## Run

```bash
# from the repo root
npm install

# build and run on a connected device/emulator (development build)
npm run android --workspace @lablens/mobile

# or: prebuild the native projects first, then run
npm run prebuild --workspace @lablens/mobile
```

Type-check and bundle checks:

```bash
npm run typecheck --workspace @lablens/mobile
npx expo export --platform android   # validates the Metro JS bundle
```

## Offline OCR

The PP-OCRv6-medium models (detection + recognition ONNX, plus the character
dictionary) are bundled in `assets/models/` and loaded via `expo-asset`. This is
the same model family the Node benchmark engine uses, so on-device extraction
matches the benchmark accuracy. OCR initializes lazily on the first import and
then runs fully offline. The image is recognized in all four 90° rotations and
the highest-confidence pass is kept, matching the Node `PaddleOcrEngine`.

Documents are transient: the selected image is converted to text and discarded,
and is never persisted (see `ImportScreen` and the privacy note below).

## Structure

```
apps/mobile/
  index.ts / App.tsx            entry + providers
  app.json                      Expo config
  metro.config.js               monorepo + asset config
  assets/models/                bundled OCR models + dictionary
  src/
    composition/backend.ts      createMobileBackend (data + OCR facade)
    db/…                        (removed — shared logic lives in @lablens/data)
    ocr/                        PaddleMobileEngine + model loader
    store/                      BackendProvider, SettingsStore
    hooks/useAppData.ts         analyte/observation summaries
    theme/  i18n/  utils/
    components/                 charts, UI primitives
    screens/                    Overview, AllValues, Detail, Import, Config,
                                Profiles, Settings, Manage, References, Menu
    navigation/                 root stack + bottom tabs
```

## Data & privacy

- Terminology/reference data is seeded once from `src/app-data.json`
  (mirrors `data/app/tests.json` at the repo root).
- Observations are stored only in the local SQLite database.
- No network calls, no analytics, no raw OCR text logging, no document
  persistence.

## Disclaimer

Reference ranges are approximate development defaults and do not constitute a
diagnosis.
