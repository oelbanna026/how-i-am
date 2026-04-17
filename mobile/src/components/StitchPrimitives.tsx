import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { stitchTheme } from '../stitchTheme';

export const StitchScreen = memo(function StitchScreen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
});

export const StitchHeader = memo(function StitchHeader({
  title,
  right
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
});

export const StitchCard = memo(function StitchCard({
  children,
  style
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
});

export const StitchButton = memo(function StitchButton({
  title,
  onPress,
  variant = 'primary',
  disabled
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? stitchTheme.colors.primary
      : variant === 'secondary'
        ? stitchTheme.colors.surfaceVariant
        : variant === 'danger'
          ? stitchTheme.colors.error
          : 'transparent';

  const border =
    variant === 'ghost' ? stitchTheme.colors.outlineVariant : variant === 'secondary' ? stitchTheme.colors.outlineVariant : 'transparent';

  const textColor =
    variant === 'primary' ? stitchTheme.colors.onPrimary : stitchTheme.colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, borderWidth: border === 'transparent' ? 0 : 1 },
        (pressed && !disabled) ? { opacity: 0.9 } : null,
        disabled ? { opacity: 0.5 } : null
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
});

export const StitchInput = memo(function StitchInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={stitchTheme.colors.onSurfaceVariant}
      style={[styles.input, props.style]}
    />
  );
});

export const StitchMuted = memo(function StitchMuted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
});

export const StitchH1 = memo(function StitchH1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
});

export const StitchRow = memo(function StitchRow({
  children,
  style
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
    paddingHorizontal: 18,
    paddingTop: 18
  },
  header: {
    height: 56,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 12
  },
  headerTitle: {
    color: stitchTheme.colors.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-start'
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(68,72,81,0.35)',
    borderWidth: 1,
    borderRadius: stitchTheme.radius.lg,
    padding: 16
  },
  button: {
    height: 50,
    borderRadius: stitchTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800'
  },
  input: {
    height: 50,
    borderRadius: stitchTheme.radius.lg,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(68,72,81,0.35)',
    color: stitchTheme.colors.onSurface,
    backgroundColor: 'rgba(255,255,255,0.03)',
    textAlign: 'right'
  },
  muted: {
    color: stitchTheme.colors.onSurfaceVariant,
    textAlign: 'right'
  },
  h1: {
    color: stitchTheme.colors.onSurface,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center'
  }
});

