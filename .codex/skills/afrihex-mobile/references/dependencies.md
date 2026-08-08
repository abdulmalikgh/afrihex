# Dependencies

Before adding a package, check:

1. Is equivalent functionality already installed?
2. Is the package actively maintained?
3. Does it support Expo SDK 57 and React Native 0.86?
4. Does it support iOS?
5. Does it support Android?
6. Does it support React Native New Architecture or avoid deprecated-only native APIs?
7. Does it require an Expo config plugin?
8. Does it require manual native project edits?
9. Does it introduce permissions?
10. Does it significantly increase app or binary size?
11. Does it introduce security or maintenance risk?

Rules:

- Use `npx expo install` for Expo-managed packages.
- Do not install overlapping libraries that solve the same problem.
- Do not upgrade unrelated dependencies during a feature task.
- Prefer maintained packages with clear Expo/React Native compatibility.
- Native dependencies require development-build validation.

MapLibre note:

- MapLibre React Native is the preferred serious map renderer.
- It requires development builds and should not be expected to run in Expo Go.
