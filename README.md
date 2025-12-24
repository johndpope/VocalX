# VocalX (Monorepo)

This repo is evolving into a full-stack VocalX platform:

- `apps/webapp`: Next.js 14 web app (Studio UI + API)
- `apps/mobile`: Expo / React Native app (standalone; manage deps inside `apps/mobile`)

## Development (local)

Install dependencies at repo root:

```bash
npm install
```

Run all apps:

```bash
npm run dev
```

## Mobile (standalone)

The mobile app is not part of the root monorepo workspaces. To run it locally:

```bash
cd apps/mobile
npm install
npm run start
```

## Legacy (archived)

The previous native Android/Kotlin on-device prototype (Gradle project + models/docs) has been archived to:

- `legacy/android-native/`



