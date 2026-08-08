# UI Implementation

Use the AfriHex web identity in mobile form:

- Body: Instrument Sans.
- Headings: Bricolage Grotesque.
- Codes: Spline Sans Mono.
- Surface: `#111814`.
- Card: `#1a231d`.
- Card alt: `#232e26`.
- Text: `#f2f4ef`.
- Muted: `#9ca89f`.
- Border: `#2a362d`.
- Primary: `#2fa162`.
- Gold: `#eab535`.
- Violet: `#8d54ff`.
- Danger: `#e07160`.

Build custom app primitives before duplicating styles:

```txt
Screen
AppText
AppButton
AppInput
SearchBar
CodeChip
ResultCard
LoadingState
EmptyState
ErrorBanner
BottomSheet
SegmentedControl
```

Keep screens compact and operational. Do not build marketing-style hero layouts for the
mobile app unless explicitly requested.

Every async screen must include loading, empty, error, and success states.
