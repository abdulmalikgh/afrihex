# API Integration

Use `mobile-api.md` as the API source of truth.

Base:

```txt
https://api.afrihex.com
```

Auth:

```txt
X-API-Key: <token>
```

Keep API code under `src/api/`:

```txt
client.ts
auth.ts
search.ts
navigation.ts
certificates.ts
profile.ts
```

Rules:

- Use typed request and response shapes.
- Normalize `{ success: false, error }` into an app error type.
- Store tokens in SecureStore.
- Never put secrets in `EXPO_PUBLIC_*`.
- Use React Query for server state.
- Include every request-affecting parameter in query keys.
- Debounce autocomplete.
- Never guess API fields.
- Confirm request method, URL, query params, body, headers, and response shape before wiring an endpoint.
- Reuse auth handling.
- Avoid API requests directly inside presentation components.
- Support cancellation where stale requests can occur.
- Prevent duplicate submissions.
- Handle unauthorized responses consistently.
- Update or invalidate related cached queries after mutations.
- If backend documentation conflicts with existing implementation, identify the discrepancy.

Coordinate warning:

- Points use `lat`/`lng` or `latitude`/`longitude`.
- Route geometry uses `[lng, lat]`.
