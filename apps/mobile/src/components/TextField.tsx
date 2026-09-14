import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/Icon';
import { color, font, radius } from '@/theme/tokens';

/**
 * Matches the web app's own hand-rolled `<label><span>…</span><input/></label>`
 * pattern (uppercase caption label, bordered field below) rather than the
 * design system's `Input` -- that component is DOM-specific and does not
 * port, per the plan doc's own warning.
 */
export function TextField({
  label,
  secureEntry,
  ...props
}: { label: string; secureEntry?: boolean } & TextInputProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureEntry);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          {...props}
          secureTextEntry={isPassword && !revealed}
          placeholderTextColor={color.textMuted}
          style={[styles.input, isPassword && styles.inputWithIcon]}
        />
        {isPassword && (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            hitSlop={8}
            style={styles.reveal}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={16} color={color.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily: font.uiSemibold,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: color.borderDefault,
    borderRadius: radius.md,
    backgroundColor: color.surfaceCard,
    color: color.textHeading,
    paddingHorizontal: 14,
    fontFamily: font.uiRegular,
    fontSize: 15,
  },
  inputWithIcon: {
    paddingRight: 42,
  },
  reveal: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
