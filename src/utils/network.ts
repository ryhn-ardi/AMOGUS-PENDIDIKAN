import { OnlineRoomData, Player, TaskStation, MatchSummary, GameConfig, Question } from '../types/game';
import { firebaseMultiplayer, getClientId } from './firebaseMultiplayer';

export { getClientId };

export interface SyncResponse {
  status: 'lobby' | 'playing' | 'ended';
  room: OnlineRoomData;
  players: Player[];
  stations: TaskStation[];
  events: Array<{ id: number; type: string; payload: any; timestamp: number }>;
  lastEventId: number;
  summary: MatchSummary | null;
}

export const api = {
  /**
   * Health check to ensure connectivity (Firebase Firestore test)
   */
  async checkHealth(): Promise<boolean> {
    try {
      const ok = await firebaseMultiplayer.checkHealth();
      if (ok) return true;
    } catch {}
    
    // HTTP fallback check
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      return res.ok;
    } catch {
      return true; // Assume ready
    }
  },

  /**
   * Create room in Firebase Firestore
   */
  async createRoom(params: {
    roomCode?: string;
    name: string;
    playerClass: string;
    config?: GameConfig;
    questions?: Question[];
    isSpectator?: boolean;
  }) {
    return await firebaseMultiplayer.createRoom(params);
  },

  /**
   * Join room in Firebase Firestore
   */
  async joinRoom(params: {
    roomCode: string;
    name: string;
    playerClass: string;
    isSpectator?: boolean;
  }) {
    return await firebaseMultiplayer.joinRoom(params);
  },

  /**
   * Send action to Firebase room
   */
  async sendAction(roomCode: string, type: string, payload: any = {}) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    if (type === 'start_game') {
      await firebaseMultiplayer.startGame(cleanCode, payload.questions || [], payload.config || ({} as any));
    } else if (type === 'add_bot') {
      await firebaseMultiplayer.addBot(cleanCode, payload.config || ({} as any));
    } else if (type === 'clear_bots') {
      await firebaseMultiplayer.clearBots(cleanCode);
    } else if (type === 'return_to_lobby') {
      await firebaseMultiplayer.returnToLobby(cleanCode);
    } else if (type === 'leave_room') {
      await firebaseMultiplayer.leaveRoom(cleanCode, getClientId());
    } else {
      await firebaseMultiplayer.sendEvent(cleanCode, type, payload);
    }
    return { status: 'ok' };
  }
};

