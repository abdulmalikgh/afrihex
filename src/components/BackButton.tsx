import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';

/**
 * The only back control on a pushed screen.
 *
 * The native stack header is switched off across the app, because an empty
 * 44pt bar holding nothing but a chevron eats the top of every screen and the
 * content then scrolls underneath it. This sits in the content flow instead, so
 * a pushed screen starts where the tab screens do.
 *
 * Pulled left by `spacing.sm` so the glyph optically aligns with the text below
 * it — the 44pt target is padding around a 24pt icon, and without the offset
 * the chevron reads as indented.
 */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress ?? (() => router.back())}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <ChevronLeft color={colors.text} size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
