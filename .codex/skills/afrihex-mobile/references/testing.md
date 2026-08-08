# Testing

Initial tools:

```bash
npx expo install jest-expo jest --dev
npx expo install @testing-library/react-native --dev
```

Test targets:

- API client success and error handling.
- Auth token storage.
- Login/register validation.
- Search loading, empty, error, and success states.
- Directions request body construction.
- Coordinate order conversion.
- Public vs authenticated route selection.
- Certificate verification states.

Later E2E:

```txt
Maestro
```

E2E flows:

```txt
login
register
search address
reverse lookup
create route
verify certificate
create profile link
```
