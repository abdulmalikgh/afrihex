# Debugging

Start with scope and environment:

- Confirm the feature is in `mobile-api.md`.
- Confirm whether the issue occurs in Expo Go, development build, or release build.
- Native map, splash, permission, and native-module issues require development or release builds.

API debugging:

- Inspect endpoint, method, request body, and auth header presence.
- Surface API error `code` and `message` during development.
- Check rate limits for public endpoints.
- Verify coordinate order before debugging routing or map rendering.

Expo debugging:

- Check exact Expo SDK 57 docs for the touched module.
- Use `npx expo doctor` when dependency compatibility is suspect.
- Clear Metro cache only after configuration or dependency changes make it necessary.

Map debugging:

- Confirm MapLibre is running in a development build.
- Render a minimal marker before adding route lines or overlays.
- Add overlays incrementally.
- Validate that route geometry is converted from `[lng, lat]`.
