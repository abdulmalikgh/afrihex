# Accessibility

Accessibility is required for AfriHex mobile.

## Interactive Controls

- Icon-only buttons require `accessibilityLabel`.
- Use `accessibilityRole` where appropriate.
- Prefer `Pressable` or `Button` semantics over clickable `View` components.
- Disabled controls must expose the correct disabled state.
- Touch targets must be comfortably usable.

## Content

- Do not communicate meaning with color alone.
- Preserve readable contrast on dark surfaces.
- Images conveying information need accessibility descriptions.
- Decorative images should not unnecessarily enter the accessibility tree.
- Do not disable font scaling globally.
- Avoid fixed-height text containers for text that can expand.

## Screen Review

For significant screens, reason through:

- VoiceOver labels and order.
- TalkBack labels and order.
- keyboard-visible form usability.
- disabled/loading states.
- long text and dynamic font sizes.
