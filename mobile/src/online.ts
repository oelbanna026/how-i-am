import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { GameMode, GamePublic, Profile, RoomPublic } from './types';

type OnlineState = {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  connected: boolean;
  connecting: boolean;
  me: { id: string; coins: number } | null;
  room: RoomPublic | null;
  game: GamePublic | null;
  lastError: string | null;
  connect: (profile: Profile) => Promise<void>;
  disconnect: () => void;
  createRoom: (args: { profile: Profile; mode: GameMode; category: string }) => Promise<string>;
  joinRoom: (args: { profile: Profile; code: string }) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  askQuestion: (text: string) => Promise<void>;
  answerQuestion: (questionId: string, answer: 'YES' | 'NO') => Promise<void>;
  useHint: (type: 'CATEGORY' | 'FIRST_LETTER') => Promise<void>;
  earnCoins: (amount: number) => Promise<void>;
  guess: (guess: string) => Promise<{ correct: boolean; winnerId: string | null }>;
};

const OnlineContext = createContext<OnlineState | null>(null);

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed.replace(/\/+$/, '');
  return `http://${trimmed.replace(/\/+$/, '')}`;
}

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrl] = useState<string>(() => {
    const fromEnv = (process.env.EXPO_PUBLIC_SERVER_URL as string | undefined) ?? '';
    return normalizeUrl(fromEnv) || 'http://localhost:3001';
  });
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [me, setMe] = useState<{ id: string; coins: number } | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [game, setGame] = useState<GamePublic | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const profileRef = useRef<Profile | null>(null);

  const cleanup = useCallback(() => {
    const s = socketRef.current;
    if (s) {
      s.removeAllListeners();
      s.disconnect();
    }
    socketRef.current = null;
    setConnected(false);
    setConnecting(false);
    setRoom(null);
    setGame(null);
  }, []);

  const connect = useCallback(
    async (profile: Profile) => {
      profileRef.current = profile;
      setLastError(null);
      if (socketRef.current?.connected) return;
      cleanup();

      setConnecting(true);
      const s = io(normalizeUrl(serverUrl), { transports: ['websocket'], timeout: 8000 });
      socketRef.current = s;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), 9000);
        s.on('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        s.on('connect_error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
      });

      const authed = await new Promise<{ ok: boolean; player?: any; error?: string }>((resolve) => {
        s.emit(
          'auth:guest',
          { deviceId: profile.deviceId, name: profile.name, avatar: profile.avatar },
          (res: any) => resolve(res)
        );
      });

      if (!authed.ok) {
        cleanup();
        throw new Error(authed.error || 'AUTH_FAILED');
      }

      setMe({ id: authed.player.id, coins: authed.player.coins });
      setConnected(true);
      setConnecting(false);

      s.on('room:update', (payload: RoomPublic | null) => {
        setRoom(payload);
        const p = payload?.players?.find((x) => x.id === authed.player.id);
        if (p) setMe((m) => (m ? { ...m, coins: p.coins } : m));
      });
      s.on('game:update', (payload: GamePublic | null) => {
        setGame(payload);
        const p = payload?.players?.find((x) => x.id === authed.player.id);
        if (p) setMe((m) => (m ? { ...m, coins: p.coins } : m));
      });
      s.on('disconnect', () => {
        setConnected(false);
      });
    },
    [cleanup, serverUrl]
  );

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const createRoom = useCallback(
    async ({ profile, mode, category }: { profile: Profile; mode: GameMode; category: string }) => {
      await connect(profile);
      const s = socketRef.current;
      if (!s) throw new Error('NO_SOCKET');
      const res = await new Promise<any>((resolve) => {
        s.emit('room:create', { mode, category, name: profile.name, avatar: profile.avatar }, (r: any) => resolve(r));
      });
      if (!res.ok) throw new Error(res.error || 'CREATE_FAILED');
      return res.code as string;
    },
    [connect]
  );

  const joinRoom = useCallback(
    async ({ profile, code }: { profile: Profile; code: string }) => {
      await connect(profile);
      const s = socketRef.current;
      if (!s) throw new Error('NO_SOCKET');
      const res = await new Promise<any>((resolve) => {
        s.emit('room:join', { code, name: profile.name, avatar: profile.avatar }, (r: any) => resolve(r));
      });
      if (!res.ok) throw new Error(res.error || 'JOIN_FAILED');
    },
    [connect]
  );

  const leaveRoom = useCallback(async () => {
    const s = socketRef.current;
    if (!s) return;
    await new Promise<void>((resolve) => {
      s.emit('room:leave', (r: any) => resolve());
    });
    setRoom(null);
    setGame(null);
  }, []);

  const setReady = useCallback(async (ready: boolean) => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('room:ready', { ready }, (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'READY_FAILED');
  }, []);

  const startGame = useCallback(async () => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('game:start', (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'START_FAILED');
  }, []);

  const askQuestion = useCallback(async (text: string) => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('game:ask', { text }, (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'ASK_FAILED');
  }, []);

  const answerQuestion = useCallback(async (questionId: string, answer: 'YES' | 'NO') => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('game:answer', { questionId, answer }, (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'ANSWER_FAILED');
  }, []);

  const useHint = useCallback(async (type: 'CATEGORY' | 'FIRST_LETTER') => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('game:hint', { type }, (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'HINT_FAILED');
    setMe((m) => (m ? { ...m, coins: res.coins } : m));
  }, []);

  const earnCoins = useCallback(async (amount: number) => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('coins:earn', { amount }, (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'EARN_FAILED');
    setMe((m) => (m ? { ...m, coins: res.coins } : m));
  }, []);

  const guess = useCallback(async (guessText: string) => {
    const s = socketRef.current;
    if (!s) throw new Error('NO_SOCKET');
    const res = await new Promise<any>((resolve) => {
      s.emit('game:guess', { guess: guessText }, (r: any) => resolve(r));
    });
    if (!res.ok) throw new Error(res.error || 'GUESS_FAILED');
    return { correct: Boolean(res.correct), winnerId: res.winnerId ?? null };
  }, []);

  useEffect(() => {
    setServerUrl((u) => normalizeUrl(u) || 'http://localhost:3001');
  }, []);

  const value = useMemo<OnlineState>(
    () => ({
      serverUrl,
      setServerUrl: (u) => setServerUrl(normalizeUrl(u)),
      connected,
      connecting,
      me,
      room,
      game,
      lastError,
      connect: async (p) => {
        try {
          await connect(p);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      disconnect,
      createRoom: async (args) => {
        try {
          return await createRoom(args);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      joinRoom: async (args) => {
        try {
          await joinRoom(args);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      leaveRoom: async () => {
        try {
          await leaveRoom();
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      setReady: async (r) => {
        try {
          await setReady(r);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      startGame: async () => {
        try {
          await startGame();
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      askQuestion: async (t) => {
        try {
          await askQuestion(t);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      answerQuestion: async (qid, ans) => {
        try {
          await answerQuestion(qid, ans);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      useHint: async (t) => {
        try {
          await useHint(t);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      earnCoins: async (amount) => {
        try {
          await earnCoins(amount);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      },
      guess: async (g) => {
        try {
          return await guess(g);
        } catch (e: any) {
          setLastError(String(e?.message ?? e));
          throw e;
        }
      }
    }),
    [
      answerQuestion,
      askQuestion,
      connect,
      connected,
      connecting,
      createRoom,
      disconnect,
      earnCoins,
      game,
      guess,
      joinRoom,
      lastError,
      leaveRoom,
      me,
      room,
      serverUrl,
      setReady,
      startGame,
      useHint
    ]
  );

  return React.createElement(OnlineContext.Provider, { value }, children);
}

export function useOnline() {
  const ctx = useContext(OnlineContext);
  if (!ctx) throw new Error('OnlineProvider missing');
  return ctx;
}
