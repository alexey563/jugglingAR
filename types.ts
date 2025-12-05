export interface Ball {
  id: number;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isActive: boolean;
  heldBy: 'left' | 'right' | null; // New: tracks if a hand is holding the ball
}

export interface HandPosition {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  vx: number; // Velocity X
  vy: number; // Velocity Y
  isPresent: boolean;
}

export enum GameState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface GameStats {
  score: number;
  highScore: number;
  duration: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}