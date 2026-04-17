export type GameMode = 'Classic' | 'Speed' | 'Battle';

export type Category =
  | 'All'
  | 'fruit'
  | 'vegetable'
  | 'food'
  | 'animal'
  | 'object';

export type Answer = 'YES' | 'NO';

export type Avatar = {
  id: string;
  emoji?: string;
  color?: string;
};

export type Player = {
  id: string;
  name: string;
  avatar: Avatar;
  coins: number;
  ready?: boolean;
  connected?: boolean;
  character?: Character | null;
};

export type Character = {
  name: string;
  category: string;
  imageUri: string;
};

export type RoomPublic = {
  code: string;
  hostId: string | null;
  status: 'LOBBY' | 'PLAYING';
  mode: GameMode;
  category: Category | string;
  players: Array<{
    id: string;
    name: string;
    avatar: Avatar;
    coins: number;
    ready: boolean;
    connected: boolean;
  }>;
};

export type QuestionPublic = {
  id: string;
  askedBy: string;
  text: string;
  createdAt: number;
  answers: Record<string, Answer | null>;
  yesCount: number;
  noCount: number;
};

export type GamePublic = {
  status: 'PLAYING' | 'ENDED';
  mode: GameMode;
  category: Category | string;
  currentTurnPlayerId: string;
  turnEndsAt: number;
  turnMs: number;
  winnerId: string | null;
  myTarget?: Character | null;
  players: Player[];
  myHints: {
    categoryRevealed: boolean;
    firstLetter: string | null;
  };
  questions: QuestionPublic[];
};

export type Profile = {
  deviceId: string;
  name: string;
  avatar: Avatar;
};
