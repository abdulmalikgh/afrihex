# State Management

Choose state based on ownership.

## State Types

- Component state: `useState` or `useReducer` for local UI state.
- Form state: React Hook Form or the existing form library.
- Server state: React Query or the existing server-state solution.
- Cross-screen client state: the existing global state solution, only when state truly spans
  screens or features.
- Persistent state: explicit persistence layer.
- Sensitive authentication state: secure native storage.

## Rules

- Do not duplicate server state into global stores.
- Do not put form inputs, modal visibility, temporary filters, or server responses into
  global state without a concrete reason.
- Do not create unnecessary context providers.
- Keep global stores small and domain-focused.
- Do not mutate state directly.
- Use the smallest appropriate scope.

Avoid this pattern:

```txt
API -> React Query -> Redux/Zustand -> component state
```

Prefer:

```txt
API -> React Query -> UI
```

Use separate persistent storage only when the state must survive app restarts.
