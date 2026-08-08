# Navigation

Use Expo Router.

Preferred routes:

```txt
app/
  _layout.tsx
  (tabs)/
    index.tsx
    map.tsx
    directions.tsx
    certificates.tsx
    profile.tsx
  auth/
    login.tsx
    register.tsx
  profile/
    new.tsx
```

Rules:

- Import navigation APIs from `expo-router`, not external `@react-navigation/*` packages.
- Keep tab labels concise: Find, Map, Directions, Verify, Profile.
- Use typed routes once Expo Router is configured.
- Keep auth screens outside the tabs.
- Do not create routes for web-only admin, dashboard, pricing, or marketing pages unless requested.
