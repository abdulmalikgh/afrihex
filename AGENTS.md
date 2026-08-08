# AfriHex Mobile Agent Rules

This repository is the AfriHex mobile app. Build it as an Expo SDK 57 React Native app
for iOS and Android, guided by `mobile-api.md`, `MOBILE_IMPLEMENTATION_PLAN.md`, and the
project-local Codex skill at `.codex/skills/afrihex-mobile/`.

## Engineering Principles

- Existing repository conventions take precedence over generic preferences unless those
  conventions introduce a correctness, security, or maintainability problem.
- Read the exact Expo SDK 57 docs before writing code for any Expo module:
  https://docs.expo.dev/versions/v57.0.0/
- Build only the mobile app scope described in `mobile-api.md`: Search, Navigation,
  Certificates, Auth, Usage, and Profile/address-link support.
- Do not build web-only admin, dashboard, pricing, billing, or marketing pages unless the
  user explicitly changes the scope.
- Prefer the repo's established guidance before adding new architectural patterns.
- Keep implementation small, typed, testable, and aligned with the AfriHex product surface.
- Do not modernize, reformat, or refactor unrelated code during feature work.

## TypeScript

- Use TypeScript for app code.
- Type API request bodies and responses explicitly.
- Avoid `any` for API data, route params, form values, and shared component props.
- Avoid unsafe assertions, `@ts-ignore`, `@ts-nocheck`, and unnecessary non-null assertions.
- Use narrow helpers for route coordinate conversions, especially API `[lng, lat]` pairs.
- Keep app-level constants and design tokens in typed modules.
- Keep API DTO types separate from domain/UI types where their shapes differ.

## Architecture

- Use Expo Router for navigation.
- In Expo SDK 57, do not import navigation APIs from external `@react-navigation/*`
  packages in app code; use `expo-router` entry points.
- Use React Query for server state, caching, retries, and request lifecycle state.
- Use SecureStore for API tokens.
- Use `EXPO_PUBLIC_*` only for non-secret build-time values.
- Use `npx expo install` for Expo-managed packages so versions match SDK 57.
- Keep API calls centralized under `src/api/` once app structure is created.
- Choose state based on ownership: local UI state, form state, server state, cross-screen
  client state, persistent state, and sensitive auth state are separate concerns.
- Feature-specific code stays inside its feature. Move code to shared directories only after
  clear cross-feature reuse exists.

## React Native

- Use React Native primitives and `StyleSheet.create` with shared design tokens.
- Never use DOM elements such as `div` or `span`, CSS files intended for web apps, or
  browser-only APIs without a React Native abstraction.
- Do not use `SafeAreaView` imported from `react-native` for new code; use the project
  safe-area solution, normally `react-native-safe-area-context`.
- Use `FlatList` for long result lists.
- Keep map and route screens practical, dense, and optimized for repeated use.
- Avoid expensive calculations in render paths.
- Validate native-module behavior in development or release builds, not only Expo Go.

## Security

- Never store API tokens in AsyncStorage, plain files, or `EXPO_PUBLIC_*` variables.
- Never treat client-side environment variables as secrets; anything shipped in the app is
  discoverable by users.
- Attach `X-API-Key` only when an endpoint requires or benefits from authentication.
- Do not log tokens, passwords, auth headers, or full user objects.
- Treat certificate verification as public; do not require login for verification.
- Do not force logout from `user.expires_at`; it is subscription expiry, not session expiry.
- Secrets belong on trusted backend infrastructure, not inside the mobile app bundle.

## Performance

- Test perceived performance outside dev mode before making performance claims.
- Debounce autocomplete and avoid stale result flashes.
- Keep route/map derived data memoized when it is large or expensive.
- Use static route images as an early fallback before native maps are stable.
- Keep map overlays bounded and simplify geometry if rendering stutters.
- Never introduce `useMemo`, `useCallback`, or `React.memo` solely because they appear to
  be performance best practices; use them for referential stability or measured render issues.

## Accessibility

- Use accessible labels for icon-only buttons.
- Use `accessibilityRole` where appropriate.
- Prefer `Pressable` or `Button` semantics over clickable `View` components.
- Keep touch targets large enough for mobile use.
- Preserve readable contrast on the dark AfriHex palette.
- Do not rely on color alone for certificate validity, warnings, or route hazards.
- Avoid fixed-height text containers for content that may grow with dynamic text settings.
- Do not disable font scaling globally.

## Testing

- Add tests proportional to risk and blast radius.
- Unit test API client success/error handling.
- Test auth token storage and logout behavior.
- Test route request body construction, especially coordinate order and auth/public route
  selection.
- Add screen-state tests for loading, empty, error, and success states once test tooling exists.

## Feature Workflow

- Understand: inspect relevant screens, components, services, types, navigation, state, tests,
  and styling conventions before editing.
- Plan: identify the smallest coherent change and any API, state, platform, security, or
  accessibility implications.
- Implement: reuse existing code first and avoid unrelated refactors.
- Handle states: loading, empty, error, success, disabled, and offline where relevant.
- Validate: run available formatter/linter/typecheck/tests and state exactly what could not run.
- Review: inspect the final diff for accidental changes, unsafe typing, secrets, logs,
  accessibility regressions, and iOS/Android implications.

## Never Do This

- Do not guess backend contracts.
- Do not call network APIs directly from presentational components.
- Do not duplicate server state into global stores.
- Do not add Redux, Zustand, Context providers, or new libraries without a concrete need.
- Do not use `ScrollView` for large server-backed collections.
- Do not use array indexes as keys when list order can change.
- Do not hardcode credentials, secrets, or repeated design values.
- Do not suppress TypeScript errors to make code pass.
- Do not leave production `console.log` debugging.
- Do not claim validation passed unless the command actually completed successfully.

## Validation

- Run TypeScript checks after code changes when available.
- Run unit tests after test infrastructure is added.
- For map, splash, location permission, and native-module work, validate on a development
  or release build.
- Use the project-local skill references under `.codex/skills/afrihex-mobile/references/`
  when implementing UI, API, forms, navigation, testing, debugging, performance, security,
  accessibility, state management, dependencies, workflows, or reviews.
