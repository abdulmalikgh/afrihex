import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';

import { AppText } from './AppText';
import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { fontFamilies, fontSizes } from '../constants/typography';

type DatePickerProps = {
  /** ISO 8601 string value */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  accessibilityLabel?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  label,
  accessibilityLabel,
  minimumDate,
  maximumDate,
  error,
  disabled,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const parsedDate = value ? new Date(value) : undefined;
  const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());

  const displayValue = isValidDate
    ? parsedDate.toLocaleDateString()
    : value
    ? value
    : 'Select date';

  const handleChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) {
      // Format as ISO 8601 without milliseconds, preserving UTC format like existing code
      const isoString = selectedDate.toISOString().replace(/\.\d+Z$/, 'Z');
      onChange(isoString);
    }
    // Close picker after selection
    setShowPicker(false);
  };

  const handleDismiss = () => {
    setShowPicker(false);
  };

  const openPicker = () => {
    if (!disabled) {
      setShowPicker(true);
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label || 'Select date'}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.button,
          error && styles.buttonError,
          disabled && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.content}>
          <AppText
            variant="body"
            tone={isValidDate ? 'default' : 'muted'}
            style={styles.text}
          >
            {displayValue}
          </AppText>
          <Calendar color={colors.muted} size={18} />
        </View>
      </Pressable>
      {error && (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      )}
      {showPicker && (
        <DateTimePicker
          value={isValidDate ? parsedDate : minimumDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          onDismiss={handleDismiss}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  buttonError: {
    borderColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
  },
  pressed: {
    opacity: 0.7,
  },
});
