import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Avatar, Character, Player } from './types';
import { theme } from './theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnPrimary,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 }
      ]}
    >
      {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.btnText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btnSecondary,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.85 }
      ]}
    >
      <Text style={styles.btnText}>{title}</Text>
    </Pressable>
  );
}

export function DangerButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btnDanger, pressed && { opacity: 0.85 }]}>
      <Text style={styles.btnText}>{title}</Text>
    </Pressable>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      style={styles.input}
      autoCapitalize="none"
    />
  );
}

export function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

export function AvatarCircle({ avatar, size = 44 }: { avatar: Avatar; size?: number }) {
  const bg = avatar.color ?? theme.colors.primary;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ fontSize: Math.max(16, size * 0.5) }}>{avatar.emoji ?? '🙂'}</Text>
    </View>
  );
}

export function CharacterBadge({ character }: { character: Character | null | undefined }) {
  if (!character) return <View style={styles.characterHidden}><Text style={styles.characterHiddenText}>?</Text></View>;
  return (
    <View style={styles.characterBadge}>
      <Image source={{ uri: character.imageUri }} style={styles.characterImg} />
      <Text numberOfLines={1} style={styles.characterName}>
        {character.name}
      </Text>
    </View>
  );
}

export function PlayerPill({
  player,
  isTurn,
  showCharacter
}: {
  player: Player;
  isTurn: boolean;
  showCharacter: boolean;
}) {
  return (
    <View style={[styles.playerPill, isTurn && styles.playerPillTurn]}>
      <CharacterBadge character={showCharacter ? player.character ?? null : null} />
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Row style={{ alignItems: 'center', gap: 10 }}>
          <AvatarCircle avatar={player.avatar} size={42} />
          <View style={{ maxWidth: 130 }}>
            <Text numberOfLines={1} style={styles.playerName}>
              {player.name}
            </Text>
            <Text style={styles.playerSub}>{player.coins} coins</Text>
          </View>
        </Row>
        {player.connected === false ? <Chip text="offline" /> : null}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing(2)
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2)
  },
  h1: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800'
  },
  muted: {
    color: theme.colors.textMuted
  },
  row: {
    flexDirection: 'row'
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnSecondary: {
    backgroundColor: theme.colors.panel,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  btnDanger: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16
  },
  input: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text
  },
  chip: {
    backgroundColor: theme.colors.card2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  chipText: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  characterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  characterImg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.panel
  },
  characterName: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    flexShrink: 1
  },
  characterHidden: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 10
  },
  characterHiddenText: {
    color: theme.colors.textMuted,
    fontWeight: '900'
  },
  playerPill: {
    backgroundColor: theme.colors.card2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.25)
  },
  playerPillTurn: {
    borderColor: theme.colors.primary2,
    shadowColor: theme.colors.primary2,
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  playerName: {
    color: theme.colors.text,
    fontWeight: '800'
  },
  playerSub: {
    color: theme.colors.textMuted,
    marginTop: 2
  }
});

