# CI

No CI is configured yet.

Future CI should run:

```bash
npm ci
npx tsc --noEmit
npm test
```

When E2E exists, add a separate workflow/job for simulator-based tests.

Do not require native map E2E in the basic PR check until the build pipeline can reliably
produce development builds.
