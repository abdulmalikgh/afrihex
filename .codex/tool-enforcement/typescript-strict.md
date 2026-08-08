# TypeScript Strict

Target:

- Keep TypeScript strict enough to catch API and navigation mistakes early.
- Avoid `any` in app code.
- Prefer explicit API, route, and form types.

Enforcement:

```bash
npx tsc --noEmit
```

When Expo Router typed routes are enabled, preserve generated type includes required by Expo.
