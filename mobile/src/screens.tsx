import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import type { GameMode, Profile } from './types';
import { categories } from './characters';
import { avatarOptions, loadProfile, resolveAvatar, saveProfile } from './profile';
import { theme } from './theme';
import { playSfx } from './sfx';
import { gameActions, useGameStore } from './gameStore';
import {
  Card,
  DangerButton,
  H1,
  Muted,
  PlayerPill,
  PrimaryButton,
  Row,
  Screen,
  SecondaryButton,
  Spacer,
  TextField
} from './ui';
import { createOfflineGame, offlineAskQuestion, offlineGuess, offlineHumanAnswer, offlineTick, type OfflineState } from './offlineAi';

type ProfileCtx = {
  profile: Profile | null;
  setName: (name: string) => void;
  setAvatarId: (avatarId: string) => void;
};

const ProfileContext = createContext<ProfileCtx | null>(null);

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('ProfileProvider missing');
  return ctx;
}

function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile().then((p) => setProfile(p));
  }, []);

  const setName = useCallback((name: string) => {
    setProfile((p) => {
      if (!p) return p;
      const next = { ...p, name: name.trim().slice(0, 16) || 'Guest' };
      saveProfile(next).catch(() => null);
      return next;
    });
  }, []);

  const setAvatarId = useCallback((avatarId: string) => {
    setProfile((p) => {
      if (!p) return p;
      const next = { ...p, avatar: resolveAvatar(avatarId) };
      saveProfile(next).catch(() => null);
      return next;
    });
  }, []);

  const value = useMemo<ProfileCtx>(() => ({ profile, setName, setAvatarId }), [profile, setAvatarId, setName]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

type RootStackParamList = {
  Home: undefined;
  Room: undefined;
  Game: undefined;
  Result: undefined;
  AI: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ navigation }: any) {
  const { profile, setName, setAvatarId } = useProfile();
  const serverUrl = useGameStore((s) => s.serverUrl);
  const connecting = useGameStore((s) => s.connecting);
  const lastError = useGameStore((s) => s.error);
  const currentRoom = useGameStore((s) => s.currentRoom);
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<GameMode>('Classic');
  const [category, setCategory] = useState<string>('All');

  const canPlay = Boolean(profile);

  useEffect(() => {
    if (currentRoom?.roomCode) navigation.navigate('Room');
  }, [navigation, currentRoom?.roomCode]);

  return (
    <Screen>
      <StatusBar style="light" />
      <H1>Who Am I? Online</H1>
      <Muted>Multiplayer guessing game with friends.</Muted>
      <Spacer />

      <Card>
        <Text style={styles.label}>Username</Text>
        <TextField value={profile?.name ?? ''} onChangeText={setName} placeholder="Your name" />
        <Spacer h={10} />
        <Text style={styles.label}>Avatar</Text>
        <Row style={{ flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          {avatarOptions.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAvatarId(a.id)}
              style={[
                styles.avatarPick,
                { backgroundColor: a.color ?? theme.colors.primary },
                profile?.avatar.id === a.id && { borderColor: theme.colors.primary2, borderWidth: 2 }
              ]}
            >
              <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
            </Pressable>
          ))}
        </Row>
      </Card>

      <Spacer />

      <Card>
        <Text style={styles.label}>Server URL</Text>
        <TextField value={serverUrl} onChangeText={gameActions.setServerUrl} placeholder="http://192.168.1.10:3001" />
        <Spacer h={10} />
        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
      </Card>

      <Spacer />

      <Card>
        <Text style={styles.label}>Mode</Text>
        <Row style={{ gap: 10, marginTop: 8 }}>
          {(['Classic', 'Speed', 'Battle'] as GameMode[]).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.pill, mode === m && styles.pillActive]}>
              <Text style={styles.pillText}>{m}</Text>
            </Pressable>
          ))}
        </Row>
        <Spacer h={10} />
        <Text style={styles.label}>Category</Text>
        <FlatList
          data={categories}
          horizontal
          keyExtractor={(x) => x}
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCategory(item)}
              style={[styles.pill, category === item && styles.pillActive]}
            >
              <Text style={styles.pillText}>{item}</Text>
            </Pressable>
          )}
        />
        <Spacer />
        <PrimaryButton
          title="Create Room"
          disabled={!canPlay}
          loading={connecting}
          onPress={async () => {
            if (!profile) return;
            try {
              playSfx('click');
              await Haptics.selectionAsync();
              await gameActions.createRoom({ name: profile.name, mode, category });
              navigation.navigate('Room');
            } catch {}
          }}
        />
        <Spacer h={10} />
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField value={joinCode} onChangeText={setJoinCode} placeholder="Room code" />
          </View>
          <View style={{ width: 130 }}>
            <SecondaryButton
              title="Join"
              disabled={!canPlay || joinCode.trim().length < 4}
              onPress={async () => {
                if (!profile) return;
                try {
                  playSfx('click');
                  await Haptics.selectionAsync();
                  await gameActions.joinRoom(joinCode.trim(), profile.name);
                  navigation.navigate('Room');
                } catch {}
              }}
            />
          </View>
        </Row>
      </Card>

      <Spacer />

      <PrimaryButton
        title="Play Offline vs AI"
        disabled={!canPlay}
        onPress={() => navigation.navigate('AI')}
      />
    </Screen>
  );
}

function RoomScreen({ navigation }: any) {
  const room = useGameStore((s) => s.currentRoom);
  const players = useGameStore((s) => s.players);
  const gameState = useGameStore((s) => s.gameState);
  const myId = useGameStore((s) => s.userId);

  useEffect(() => {
    if (!room) navigation.navigate('Home');
  }, [navigation, room]);

  useEffect(() => {
    if (gameState?.flow === 'playing') navigation.navigate('Game');
  }, [navigation, gameState?.flow]);

  if (!room) return null;
  const isHost = room.hostId === myId;

  return (
    <Screen>
      <StatusBar style="light" />
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <H1>Room {room.roomCode}</H1>
          <Muted>Max {room.maxPlayers} players • {room.mode} • {room.category}</Muted>
        </View>
        <DangerButton
          title="Leave"
          onPress={async () => {
            playSfx('click');
            await gameActions.leaveRoom();
            navigation.navigate('Home');
          }}
        />
      </Row>

      <Spacer />

      <Card>
        <Text style={styles.label}>Players</Text>
        <Spacer h={10} />
        {players.map((p) => (
          <Row key={p.id} style={styles.roomPlayerRow}>
            <Text style={styles.roomPlayerName}>{p.name}</Text>
            <Text style={styles.roomPlayerReady}>{p.connected ? 'ONLINE' : 'OFFLINE'}</Text>
          </Row>
        ))}
      </Card>

      <Spacer />

      <Card>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title="Join Voice"
              onPress={async () => {
                try {
                  playSfx('click');
                  await Haptics.selectionAsync();
                  await gameActions.joinVoiceRoom(room.roomCode);
                } catch {}
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title="Start Game"
              disabled={!isHost || players.length < 2}
              onPress={async () => {
                try {
                  playSfx('click');
                  await Haptics.selectionAsync();
                  await gameActions.startGame();
                } catch (e: any) {
                  Alert.alert('Cannot start', String(e?.message ?? e));
                }
              }}
            />
          </View>
        </Row>
      </Card>
    </Screen>
  );
}

function GameScreen({ navigation }: any) {
  const gameState = useGameStore((s) => s.gameState);
  const myId = useGameStore((s) => s.userId) ?? '';
  const voiceState = useGameStore((s) => s.voiceState);
  const [customQ, setCustomQ] = useState('');
  const [guessText, setGuessText] = useState('');
  const [, forceTick] = useState(0);
  const lastWarn = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      forceTick((x) => x + 1);
      const remainingSec = Math.ceil(Math.max(0, (gameState?.timer?.turnEndsAt ?? 0) - Date.now()) / 1000);
      if (remainingSec <= 5 && remainingSec > 0 && lastWarn.current !== remainingSec) {
        lastWarn.current = remainingSec;
        playSfx('warning');
      }
    }, 250);
    return () => clearInterval(t);
  }, [gameState?.timer?.turnEndsAt]);

  useEffect(() => {
    if (!gameState) navigation.navigate('Home');
  }, [navigation, gameState]);

  useEffect(() => {
    if (gameState?.flow === 'ended') navigation.navigate('Result');
  }, [navigation, gameState?.flow]);

  if (!gameState) return null;
  const isMyTurn = gameState.currentTurn === myId;
  const remainingMs = Math.max(0, (gameState.timer?.turnEndsAt ?? 0) - Date.now());
  const remainingSec = Math.ceil(remainingMs / 1000);
  const latest = gameState.questions?.[0];
  const needsAnswer = latest && latest.answers?.[myId] === null && latest.askedBy !== myId;

  const ask = async (text: string) => {
    if (!text.trim()) return;
    try {
      playSfx('click');
      await Haptics.selectionAsync();
      await gameActions.sendQuestion(text);
      setCustomQ('');
    } catch {}
  };

  return (
    <Screen>
      <StatusBar style="light" />
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <H1>Game</H1>
          <Muted>Turn timer: {remainingSec}s</Muted>
        </View>
        <SecondaryButton title="Room" onPress={() => navigation.navigate('Room')} />
      </Row>

      <Spacer />

      <Card>
        <Text style={styles.label}>Players</Text>
        <Spacer h={10} />
        {gameState.players?.map((p: any) => (
          <PlayerPill key={p.id} player={p} isTurn={p.id === gameState.currentTurn} showCharacter={p.id !== myId} />
        ))}
      </Card>

      <Spacer />

      <Card>
        <Text style={styles.label}>Latest Question</Text>
        <Spacer h={10} />
        {latest ? (
          <>
            <Text style={styles.questionText}>{latest.text}</Text>
            <Muted>
              YES {latest.yesCount} • NO {latest.noCount}
            </Muted>
            <Spacer h={10} />
            {needsAnswer ? (
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="YES"
                    onPress={async () => {
                      try {
                        playSfx('click');
                        await Haptics.selectionAsync();
                        await gameActions.sendAnswer(latest.id, 'YES');
                      } catch {}
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    title="NO"
                    onPress={async () => {
                      try {
                        playSfx('click');
                        await Haptics.selectionAsync();
                        await gameActions.sendAnswer(latest.id, 'NO');
                      } catch {}
                    }}
                  />
                </View>
              </Row>
            ) : (
              <Muted>{latest.askedBy === myId ? 'Waiting for answers…' : 'Answered or not required.'}</Muted>
            )}
          </>
        ) : (
          <Muted>No questions yet.</Muted>
        )}
      </Card>

      <Spacer />

      <Card>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.label}>Your Actions</Text>
          <Text style={styles.coins}>{isMyTurn ? 'YOUR TURN' : 'WAIT'}</Text>
        </Row>
        <Spacer h={10} />

        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I a human?" disabled={!isMyTurn} onPress={() => ask('Am I a human?')} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I famous?" disabled={!isMyTurn} onPress={() => ask('Am I famous?')} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I male?" disabled={!isMyTurn} onPress={() => ask('Am I male?')} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I female?" disabled={!isMyTurn} onPress={() => ask('Am I female?')} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I alive?" disabled={!isMyTurn} onPress={() => ask('Am I alive?')} />
          </View>
        </Row>

        <Spacer />

        <TextField value={customQ} onChangeText={setCustomQ} placeholder="Type a custom yes/no question…" />
        <Spacer h={10} />
        <PrimaryButton title="Ask Custom Question" disabled={!isMyTurn || !customQ.trim()} onPress={() => ask(customQ)} />

        <Spacer />

        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton title="Toggle Mic" onPress={async () => gameActions.toggleMic()} />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title={voiceState.roomId ? `Voice: ${voiceState.participants.length}` : 'Join Voice'}
              onPress={async () => gameActions.joinVoiceRoom()}
            />
          </View>
        </Row>

        <Spacer />

        <TextField value={guessText} onChangeText={setGuessText} placeholder="Guess your character name…" />
        <Spacer h={10} />
        <PrimaryButton
          title="Submit Guess"
          disabled={!guessText.trim()}
          onPress={async () => {
            try {
              playSfx('click');
              await Haptics.selectionAsync();
              const res = await gameActions.makeGuess(guessText);
              playSfx(res.correct ? 'correct' : 'wrong');
              setGuessText('');
            } catch {}
          }}
        />
      </Card>
    </Screen>
  );
}

function ResultScreen({ navigation }: any) {
  const gameState = useGameStore((s) => s.gameState);
  const myId = useGameStore((s) => s.userId);
  if (!gameState) return null;

  const scoreboard = Array.isArray(gameState.scoreboard) ? gameState.scoreboard : [];
  const winner = scoreboard.find((x: any) => x.playerId === gameState.winnerId);

  return (
    <Screen>
      <StatusBar style="light" />
      <H1>{winner ? `${winner.name} wins!` : 'Game Over'}</H1>
      <Muted>{gameState.endReason ? `Reason: ${gameState.endReason}` : 'Match finished'}</Muted>
      <Spacer />
      <Card>
        <Text style={styles.label}>Scoreboard</Text>
        <Spacer h={10} />
        {scoreboard.length ? (
          scoreboard.map((p: any) => (
            <Row key={p.playerId} style={{ alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={styles.questionText}>{p.name}{p.playerId === myId ? ' (you)' : ''}</Text>
              <Text style={styles.mutedSmall}>{p.score}</Text>
            </Row>
          ))
        ) : (
          <Muted>No scoreboard.</Muted>
        )}
      </Card>
      <Spacer />
      <PrimaryButton
        title="Back to Home"
        onPress={async () => {
          playSfx('click');
          await gameActions.leaveRoom();
          navigation.navigate('Home');
        }}
      />
    </Screen>
  );
}

function AIScreen({ navigation }: any) {
  const { profile } = useProfile();
  const [mode, setMode] = useState<GameMode>('Classic');
  const [category, setCategory] = useState<string>('All');
  const [state, setState] = useState<OfflineState | null>(null);
  const [customQ, setCustomQ] = useState('');
  const [guessText, setGuessText] = useState('');

  useEffect(() => {
    if (!profile) return;
    setState(createOfflineGame({ me: { id: 'me', name: profile.name, avatar: profile.avatar }, mode, category }));
  }, [profile, mode, category]);

  useEffect(() => {
    const t = setInterval(() => setState((s) => (s ? offlineTick(s) : s)), 300);
    return () => clearInterval(t);
  }, []);

  if (!profile || !state) return null;

  const meId = state.players[0].id;
  const isMyTurn = state.currentTurnPlayerId === meId;
  const remainingSec = Math.ceil(Math.max(0, state.turnEndsAt - Date.now()) / 1000);
  const latest = state.questions[0];

  if (state.winnerId) {
    const winner = state.players.find((p) => p.id === state.winnerId);
    return (
      <Screen>
        <StatusBar style="light" />
        <H1>{winner ? `${winner.name} wins!` : 'Game Over'}</H1>
        <Spacer />
        <PrimaryButton title="Play Again" onPress={() => setState(createOfflineGame({ me: { id: 'me', name: profile.name, avatar: profile.avatar }, mode, category }))} />
        <Spacer h={10} />
        <SecondaryButton title="Back" onPress={() => navigation.navigate('Home')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="light" />
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <H1>Offline vs AI</H1>
          <Muted>Turn timer: {remainingSec}s</Muted>
        </View>
        <SecondaryButton title="Home" onPress={() => navigation.navigate('Home')} />
      </Row>

      <Spacer />

      <Card>
        <Text style={styles.label}>Mode</Text>
        <Spacer h={10} />
        <Row style={{ gap: 10 }}>
          {(['Classic', 'Speed', 'Battle'] as GameMode[]).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.pill, mode === m && styles.pillActive]}>
              <Text style={styles.pillText}>{m}</Text>
            </Pressable>
          ))}
        </Row>
        <Spacer />
        <Text style={styles.label}>Category</Text>
        <FlatList
          data={categories}
          horizontal
          keyExtractor={(x) => x}
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCategory(item)}
              style={[styles.pill, category === item && styles.pillActive]}
            >
              <Text style={styles.pillText}>{item}</Text>
            </Pressable>
          )}
        />
      </Card>

      <Spacer />

      <Card>
        <Text style={styles.label}>Players</Text>
        <Spacer h={10} />
        {state.players.map((p) => (
          <PlayerPill key={p.id} player={p} isTurn={p.id === state.currentTurnPlayerId} showCharacter={p.id !== meId} />
        ))}
      </Card>

      <Spacer />

      <Card>
        <Text style={styles.label}>Latest Question</Text>
        <Spacer h={10} />
        {latest ? (
          <>
            <Text style={styles.questionText}>{latest.text}</Text>
            <Muted>
              YES {latest.yesCount} • NO {latest.noCount}
            </Muted>
          </>
        ) : (
          <Muted>No questions yet.</Muted>
        )}
        <Spacer h={10} />
        {state.awaitingHumanAnswer && latest?.id === state.awaitingHumanAnswer.questionId ? (
          <Row style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="YES"
                onPress={async () => {
                  playSfx('click');
                  await Haptics.selectionAsync();
                  setState((s) => (s ? offlineHumanAnswer(s, state.awaitingHumanAnswer!.questionId, 'YES') : s));
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                title="NO"
                onPress={async () => {
                  playSfx('click');
                  await Haptics.selectionAsync();
                  setState((s) => (s ? offlineHumanAnswer(s, state.awaitingHumanAnswer!.questionId, 'NO') : s));
                }}
              />
            </View>
          </Row>
        ) : (
          <Muted>{isMyTurn ? 'Ask a question to find who you are.' : 'Wait for your turn.'}</Muted>
        )}
      </Card>

      <Spacer />

      <Card>
        <Text style={styles.label}>Your Actions</Text>
        <Spacer h={10} />
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I a human?" disabled={!isMyTurn} onPress={() => setState((s) => (s ? offlineAskQuestion(s, meId, 'Am I a human?') : s))} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I famous?" disabled={!isMyTurn} onPress={() => setState((s) => (s ? offlineAskQuestion(s, meId, 'Am I famous?') : s))} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I male?" disabled={!isMyTurn} onPress={() => setState((s) => (s ? offlineAskQuestion(s, meId, 'Am I male?') : s))} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I female?" disabled={!isMyTurn} onPress={() => setState((s) => (s ? offlineAskQuestion(s, meId, 'Am I female?') : s))} />
          </View>
          <View style={{ width: '48%' }}>
            <SecondaryButton title="Am I alive?" disabled={!isMyTurn} onPress={() => setState((s) => (s ? offlineAskQuestion(s, meId, 'Am I alive?') : s))} />
          </View>
        </Row>
        <Spacer />
        <TextField value={customQ} onChangeText={setCustomQ} placeholder="Custom question…" />
        <Spacer h={10} />
        <PrimaryButton
          title="Ask Custom Question"
          disabled={!isMyTurn || !customQ.trim()}
          onPress={async () => {
            playSfx('click');
            await Haptics.selectionAsync();
            setState((s) => (s ? offlineAskQuestion(s, meId, customQ) : s));
            setCustomQ('');
          }}
        />
        <Spacer />
        <TextField value={guessText} onChangeText={setGuessText} placeholder="Guess your character name…" />
        <Spacer h={10} />
        <PrimaryButton
          title="Submit Guess"
          disabled={!guessText.trim()}
          onPress={async () => {
            playSfx('click');
            await Haptics.selectionAsync();
            setState((s) => (s ? offlineGuess(s, meId, guessText) : s));
            setGuessText('');
          }}
        />
      </Card>
    </Screen>
  );
}

export function AppRoot() {
  return (
    <ProfileProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: theme.colors.bg }
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Room" component={RoomScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="AI" component={AIScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ProfileProvider>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.colors.textMuted,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700'
  },
  pill: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  pillActive: {
    borderColor: theme.colors.primary2,
    backgroundColor: '#1B1233'
  },
  pillText: {
    color: theme.colors.text,
    fontWeight: '700'
  },
  avatarPick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  roomPlayerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  roomPlayerName: {
    color: theme.colors.text,
    fontWeight: '700'
  },
  roomPlayerReady: {
    color: theme.colors.textMuted,
    fontWeight: '900'
  },
  questionText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16
  },
  coins: {
    color: theme.colors.primary2,
    fontWeight: '900'
  },
  mutedSmall: {
    color: theme.colors.textMuted,
    fontWeight: '700'
  }
});
