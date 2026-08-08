# AfriHex Mobile Engineering Rules

Use these standards when implementing or reviewing code in this repository.

## Expo And Dependencies

- Read exact Expo SDK 57 docs before adding or using Expo modules.
- Install Expo-managed packages with `npx expo install`.
- Use `npm install` only for non-Expo packages such as React Query, Zod, and Lucide.
- Do not assume native modules work in Expo Go. Validate native modules in development
  builds with `npx expo run:ios` or `npx expo run:android`.
- Keep `package-lock.json` and `pnpm-lock.yaml` churn intentional. Prefer the package
  manager already used for the task.
- Before adding a dependency, verify the existing project cannot solve the problem, check
  Expo SDK 57 compatibility, iOS/Android support, New Architecture support, native build
  impact, required permissions, bundle size, and maintenance/security risk.

## TypeScript

- Type API request bodies and responses explicitly.
- Avoid `any` for API data, navigation params, and form values.
- Avoid unsafe assertions, `@ts-ignore`, `@ts-nocheck`, and unnecessary non-null assertions.
- Prefer `unknown` for genuinely unknown input, discriminated unions for state, and runtime
  validation for untrusted external data where it matters.
- Keep API DTO types separate from domain/UI types where their shapes differ.
- Use narrow utility functions for repeated conversions such as route `[lng, lat]` pairs
  into app/map coordinates.
- Prefer discriminated unions for loading/success/error UI states when a component owns
  complex state.

## React

- Use functional components and hooks.
- Do not perform side effects during render.
- Do not store derived values in state when they can be computed from existing data.
- Do not add `useMemo`, `useCallback`, or `React.memo` without a meaningful reason.
- Prefer composition over large configurable components.
- Extract hooks only when logic is reusable or meaningfully clarifies a feature boundary.

## State Ownership

- Component state: temporary local UI state.
- Form state: React Hook Form or the existing form library.
- Server state: React Query or the existing server-state solution.
- Cross-screen client state: the existing global state solution, only when the state truly
  crosses feature/screen boundaries.
- Persistent state: an explicit persistence layer.
- Sensitive auth state: secure native storage.
- Do not duplicate server state from React Query into global stores or component state.

## API Client

- Keep the base client in `src/api/client.ts`.
- Normalize server errors into one app-level error type.
- Include `X-API-Key` only when a token exists and the endpoint requires or benefits from it.
- Do not hide rate-limit or auth failures behind generic messages during development.
- Use React Query query keys that include every request parameter that affects the result.
- Debounce autocomplete input and cancel stale requests where supported.
- Never guess API fields. If backend docs conflict with existing implementation, identify
  the discrepancy before choosing one.
- Prevent duplicate submissions and invalidate/update relevant cached data after mutations.

## Auth And Storage

- Store API tokens in `expo-secure-store`.
- Do not store secrets in `EXPO_PUBLIC_*` variables.
- Never treat client-side environment variables as secrets; anything bundled into the app
  must be considered discoverable.
- Do not force logout from `user.expires_at`; that is subscription expiry.
- Centralize auth session state so screens do not each read SecureStore directly.
- Never log tokens, passwords, auth headers, OTPs, or sensitive personal user data.
- Clear sensitive cached state on logout.

## UI Components

- Build shared primitives before duplicating styles across screens.
- Use design tokens from the AfriHex palette.
- Keep cards shallow; do not nest cards inside cards.
- Use stable dimensions for toolbars, tabs, chips, and buttons to avoid layout shift.
- Keep touch targets large enough for mobile use.
- Every async feature needs loading, empty, error, and success states.
- Do not create abstractions for one-off trivial markup.
- Avoid boolean-prop explosions; prefer explicit variants when presentation modes are real.

## React Native Platform Rules

- Use React Native primitives, not DOM elements.
- Do not use browser-only APIs without a React Native-compatible abstraction.
- Respect safe areas, keyboard behavior, Android back navigation, permissions, status bars,
  navigation bars, screen sizes, and platform accessibility settings.
- Do not use `SafeAreaView` from `react-native` for new code; use `react-native-safe-area-context`.
- Use platform-specific files only when behavior meaningfully differs.

## Forms

- Use `react-hook-form` and `zod` for non-trivial forms.
- Keep validation messages direct and field-specific.
- Disable submit while a mutation is pending.
- Preserve user input when a request fails.

## Maps And Location

- Ask for location only at the moment it provides value.
- Continue to support manual search when location permission is denied.
- Convert route geometry carefully: API route arrays are `[lng, lat]`.
- For early route previews, prefer static images over a rushed native map integration.
- Once MapLibre is added, test on a development build and real device where possible.

## Performance

- Test perceived performance in release or development builds, not only dev mode.
- Use `FlatList` for long result lists.
- Do not render large dynamic collections with `ScrollView` plus `items.map`.
- Avoid expensive calculations in render paths; memoize derived route/map data where it
  is measurably useful.
- Keep map overlays bounded and simplify geometry before rendering if the UI stutters.
- Avoid unnecessary global state; most server data belongs in React Query.
- Keep huge objects and binary files out of React state.
- Remove development logging from production code.

## Accessibility

- Use descriptive labels for icon-only buttons.
- Use appropriate accessibility roles.
- Use `Pressable` or `Button` for interactive controls instead of clickable `View` components.
- Preserve readable contrast on dark surfaces.
- Do not rely on color alone for certificate validity or route warnings.
- Support dynamic text reasonably by avoiding fixed-height text containers where content
  length varies.
- Do not disable font scaling globally.
- Significant screens should be reviewed conceptually for VoiceOver and TalkBack behavior.

## Feature Implementation Workflow

1. Understand relevant screens, components, API/service code, types, navigation, state,
   tests, and styling conventions.
2. Plan the smallest coherent change and identify API, state, platform, security, and
   accessibility implications.
3. Implement without unrelated refactors.
4. Handle loading, empty, error, success, disabled, and offline states where relevant.
5. Add or update meaningful tests.
6. Run available formatter, linter, type checker, and relevant tests.
7. Review the diff for duplication, accidental changes, unsafe typing, secrets, logs,
   accessibility regressions, and iOS/Android behavior.

## Bug Fixing Workflow

1. Reproduce or identify the exact failure path.
2. Find the root cause rather than masking the symptom.
3. Inspect related call sites before changing shared behavior.
4. Make the smallest safe fix.
5. Add a regression test when feasible.
6. Do not silently change unrelated behavior.
7. Run relevant validation.
8. Explain the root cause and fix after completion.

## Testing

- Add unit tests for API client behavior before expanding API surface area.
- Test route request body construction, especially coordinate order and auth/public route
  selection.
- Test auth token storage and logout behavior.
- Test key screen states: loading, empty, error, success.
- Add end-to-end flows with Maestro after the main screens exist.

## Review Checklist

Before considering a feature done:

- It is inside `mobile-api.md` scope.
- It follows Expo SDK 57 docs for touched modules.
- It uses the shared theme/components.
- It handles loading, error, and empty states.
- It does not expose secrets.
- It has type coverage for request and response shapes.
- It has tests proportional to risk.
- Native functionality was validated in an appropriate build.
- The final diff contains no accidental rewrites, debug logs, hardcoded secrets, or
  unrelated formatting churn.
