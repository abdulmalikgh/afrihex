# Code Review

Review AfriHex mobile changes in this order:

1. Scope: is the feature in `mobile-api.md`?
2. Expo: were SDK 57 docs followed for touched modules?
3. API: are request and response types explicit?
4. Auth: are tokens stored only in SecureStore?
5. Coordinates: is route geometry handled as `[lng, lat]`?
6. UI: does it use shared tokens/components?
7. States: are loading, empty, error, and success states handled?
8. Accessibility: are icon buttons labelled and contrast readable?
9. Performance: are lists virtualized and derived data stable?
10. Tests: is coverage proportional to risk?
11. State: is server, form, persistent, and client state owned by the right layer?
12. Dependencies: was every new package necessary and SDK-compatible?
13. Platform: were iOS, Android, safe area, keyboard, and permission implications considered?
14. Secrets: are there no credentials, tokens, or private keys in client-visible code?

Call out blockers before style preferences.
