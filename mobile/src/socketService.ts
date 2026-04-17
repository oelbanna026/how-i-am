import { io, type Socket } from 'socket.io-client';

export type SocketHandlers = {
  onConnect?: (socket: Socket) => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  onRoomUpdate?: (payload: any) => void;
  onGameStart?: (payload: any) => void;
  onTurnUpdate?: (payload: any) => void;
  onQuestionReceived?: (payload: any) => void;
  onAnswerResult?: (payload: any) => void;
  onGuessResult?: (payload: any) => void;
  onGameEnd?: (payload: any) => void;
  onUserJoinedVoice?: (payload: any) => void;
  onUserLeftVoice?: (payload: any) => void;
  onUserMuted?: (payload: any) => void;
  onUserSpeaking?: (payload: any) => void;
};

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed.replace(/\/+$/, '');
  return `http://${trimmed.replace(/\/+$/, '')}`;
}

let socket: Socket | null = null;
let currentUrl = '';

export function getSocket() {
  return socket;
}

export async function connectSocket(serverUrl: string) {
  const url = normalizeUrl(serverUrl);
  if (!url) throw new Error('MISSING_SERVER_URL');

  if (socket && socket.connected && currentUrl === url) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentUrl = url;
  socket = io(url, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000
  });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), 11000);
    socket!.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    socket!.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  return socket!;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  currentUrl = '';
}

export function listenToEvents(handlers: SocketHandlers) {
  if (!socket) throw new Error('NO_SOCKET');
  socket.removeAllListeners();

  socket.on('connect', () => handlers.onConnect?.(socket!));
  socket.on('disconnect', () => handlers.onDisconnect?.());

  socket.on('roomUpdate', (p) => handlers.onRoomUpdate?.(p));
  socket.on('gameStart', (p) => handlers.onGameStart?.(p));
  socket.on('turnUpdate', (p) => handlers.onTurnUpdate?.(p));
  socket.on('questionReceived', (p) => handlers.onQuestionReceived?.(p));
  socket.on('answerResult', (p) => handlers.onAnswerResult?.(p));
  socket.on('guessResult', (p) => handlers.onGuessResult?.(p));
  socket.on('gameEnd', (p) => handlers.onGameEnd?.(p));

  socket.on('userJoinedVoice', (p) => handlers.onUserJoinedVoice?.(p));
  socket.on('userLeftVoice', (p) => handlers.onUserLeftVoice?.(p));
  socket.on('userMuted', (p) => handlers.onUserMuted?.(p));
  socket.on('userSpeaking', (p) => handlers.onUserSpeaking?.(p));
}

export async function emitAck<T = any>(event: string, payload?: any): Promise<T> {
  if (!socket) throw new Error('NO_SOCKET');
  const res = await new Promise<any>((resolve) => {
    socket!.emit(event, payload ?? {}, (r: any) => resolve(r));
  });
  if (!res?.ok) throw new Error(String(res?.error ?? 'REQUEST_FAILED'));
  return res as T;
}
