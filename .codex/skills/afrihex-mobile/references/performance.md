# Performance

React Native performance must be judged outside normal dev-mode assumptions.

Rules:

- Use `FlatList` for long results.
- Debounce autocomplete.
- Avoid expensive calculations in render.
- Memoize route/map derived data when large.
- Keep bottom sheets and map overlays stable in size.
- Do not animate heavy map overlays during initial implementation.
- Test map and route screens in development or release builds.
- Never optimize blindly.
- Do not memoize everything automatically.
- Do not use `useMemo`, `useCallback`, or `React.memo` solely because they look like best practices.
- Avoid synchronous heavy operations during interactions.
- Keep huge objects and binary files out of React state.
- Avoid unnecessary native calls inside tight loops.
- Remove development logging from production.

Common risk areas:

- rendering many search results without virtualization
- route polyline conversion on every render
- excessive React Query refetches from unstable query keys
- too many GeoJSON overlays at once
- fixed-height text containers that clip dynamic text
