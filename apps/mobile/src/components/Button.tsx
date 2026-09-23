import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { color, font, layout, radius } from '@/theme/tokens';

type Variant = 'primary' | 'secondary';

/**
 * The one button shape used across auth and (soon) the rest of the app --
 * matching the web app's own inline-styled buttons (pill radius, brand fill
 * for primary) rather than a native platform button, same reasoning as
 * every custom-drawn control in this codebase: a consistent brand look
 * across iOS/Android/web beats either platform's default chrome.
 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  iconRight,
}: {
  children: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  iconRight?: string;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'primary' ? color.textOnBrand : color.brand} />
        ) : (
          <>
            <Text style={[styles.label, variant === 'primary' ? styles.labelPrimary : styles.labelSecondary]}>
              {children}
            </Text>
            {iconRight && <Icon name={iconRight} size={16} color={variant === 'primary' ? color.textOnBrand : color.brand} />}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.controlHLg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: color.brand,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: font.uiMedium,
    fontSize: 13,
  },
  labelPrimary: {
    color: color.textOnBrand,
  },
  labelSecondary: {
    color: color.textHeading,
  },
});

export function TextButton({ children, onPress, disabled = false, role = 'button', hint }: { children: string; onPress: () => void; disabled?: boolean; role?: 'button' | 'link'; hint?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole={role} accessibilityHint={hint} hitSlop={8}>
      <Text style={{ fontFamily: font.uiSemibold, fontSize: 13, color: color.brand, opacity: disabled ? 0.6 : 1 }}>{children}</Text>
    </Pressable>
  );
}
