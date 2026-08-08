# Workflows

## Feature Implementation

1. Understand:
   - relevant screen
   - relevant components
   - API/service code
   - domain types
   - navigation
   - state management
   - tests
   - styling conventions
2. Plan:
   - files that need modification
   - reusable existing code
   - new code genuinely required
   - API/state implications
   - platform-specific implications
   - security and accessibility implications
3. Implement the smallest coherent change.
4. Handle UI states:
   - loading
   - empty
   - error
   - success
   - disabled
   - offline where relevant
5. Add or update meaningful tests.
6. Validate with the repository's available commands.
7. Review the diff for duplication, accidental changes, unsafe typing, secrets, debug logs,
   accessibility regressions, and iOS/Android behavior.

## Bug Fixing

1. Reproduce or identify the exact failure path.
2. Find the root cause rather than masking the symptom.
3. Inspect related call sites before changing shared behavior.
4. Make the smallest safe fix.
5. Add a regression test when feasible.
6. Do not silently change unrelated behavior.
7. Run relevant validation.
8. Explain the root cause and the fix after completion.

Avoid defensive optional chaining that hides a broken contract. If a required field is
unexpectedly missing, find out why.

## Validation Honesty

Never claim a command passed unless it actually completed successfully. If validation cannot
run, state exactly what was not validated and why.
