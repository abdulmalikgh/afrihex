---
name: afrihex-mobile
description: Build, review, or plan AfriHex mobile app work in this repository. Use for Expo SDK 57 React Native implementation, AfriHex API integration from mobile-api.md, mobile navigation/search/certificates/profile features, MapLibre decisions, design-system work, engineering rules, and project-specific code reviews.
---

# AfriHex Mobile

Use this skill when working on the AfriHex mobile app.

## Required Context

Read these files before implementing:

- `AGENTS.md`
- `mobile-api.md`
- `MOBILE_API_EXAMPLES.md`
- `MOBILE_IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_PLAN_FROM_WEB.md`
- `docs/PROJECT_KNOWLEDGE.md`
- `docs/ENGINEERING_RULES.md`

Read exact Expo SDK 57 docs for every Expo module touched before writing code:

- https://docs.expo.dev/versions/v57.0.0/

## Core Workflow

1. Confirm the requested feature is inside `mobile-api.md` scope.
2. Inspect the current repo shape before choosing files or dependencies.
3. Use Expo Router for navigation and SDK 57-compatible Expo modules.
4. Use the AfriHex design tokens and shared components.
5. Keep API integration typed and centralized under `src/api/`.
6. Use React Query for server state and SecureStore for auth tokens.
7. Apply the feature or bug-fix workflow from `references/workflows.md`.
8. Validate with TypeScript/tests when available.

## Architecture Defaults

- Navigation: Expo Router.
- Server state: React Query.
- Auth token storage: Expo SecureStore.
- Location: Expo Location.
- Maps: MapLibre React Native for polished maps; static route images for early fallback.
- Forms: React Hook Form plus Zod for non-trivial forms.
- Icons: Lucide React Native.
- Styling: React Native `StyleSheet.create` plus shared tokens/components.

## Design Defaults

Use:

- Body: Instrument Sans.
- Headings: Bricolage Grotesque.
- Codes: Spline Sans Mono.
- Dark surface `#111814`.
- Card `#1a231d`.
- Primary action green `#2fa162`.
- Gold and violet as accents.

Build compact mobile screens for repeated use. Do not build web-style marketing sections
unless explicitly requested.

## API Reminders

- Base URL: `https://api.afrihex.com`.
- Auth header: `X-API-Key`.
- Public routes exist for search, certificate verification, and public routing.
- `user.expires_at` is subscription expiry, not session expiry.
- Route geometry uses `[lng, lat]`, not `[lat, lng]`.

## Reference Files

- `references/mobile-patterns.md`: implementation patterns for API, navigation, maps, and state.
- `references/ui-implementation.md`: AfriHex mobile UI and design-system rules.
- `references/api-integration.md`: API client, auth, React Query, and endpoint patterns.
- `references/forms.md`: form and validation patterns.
- `references/navigation.md`: Expo Router structure and route rules.
- `references/testing.md`: unit and E2E testing patterns.
- `references/debugging.md`: debugging workflow for Expo, API, and native issues.
- `references/performance.md`: React Native performance expectations.
- `references/code-review.md`: project-specific review checklist.
- `references/workflows.md`: feature implementation and bug-fixing workflow.
- `references/state-management.md`: state ownership rules.
- `references/security.md`: secrets, auth, permissions, and storage rules.
- `references/accessibility.md`: VoiceOver/TalkBack and interaction rules.
- `references/dependencies.md`: dependency selection checklist.
- `references/react-native-rules.md`: React Native platform, layout, list, image, and safe-area rules.
