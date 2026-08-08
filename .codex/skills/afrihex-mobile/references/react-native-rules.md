# React Native Rules

## Platform Basics

- Use React Native primitives, not DOM elements.
- Never use `div`, `span`, DOM CSS files, or browser-only APIs without an RN abstraction.
- Account for iOS and Android differences.
- Use platform-specific files only when behavior meaningfully differs.
- Do not duplicate complete components for small platform differences.

## Layout

- Respect safe areas, keyboards, status bars, navigation bars, and dynamic screen sizes.
- Do not use `SafeAreaView` from `react-native` for new code.
- Use `react-native-safe-area-context` when safe-area handling is needed.
- Avoid absolute positioning for primary page layouts unless the design requires it.
- A screenshot is evidence of one viewport, not a complete responsive specification.

## Lists

- Use `FlatList` or `SectionList` for potentially large data.
- Do not render large dynamic collections with `ScrollView` and `items.map`.
- Use stable keys from persistent identifiers.
- Avoid array indexes as keys when order can change.
- Keep expensive work out of `renderItem`.
- Use pagination for large remote datasets.

## Images

- Use the project's standard image component/library.
- Define dimensions or aspect ratio.
- Avoid unnecessarily large images.
- Use thumbnails in lists when available.
- Handle loading and failed-load states.
- Do not keep huge binary payloads in React state.

## Keyboard

- Forms must remain usable while the keyboard is visible.
- Important fields and primary actions must remain reachable.
- Use appropriate keyboard types and return-key behavior.
- Do not stack multiple keyboard avoidance strategies without understanding layout.
