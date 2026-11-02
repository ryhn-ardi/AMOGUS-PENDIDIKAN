import { OnlineRoomData, Player, TaskStation, MatchSummary } from '../types/game';

// Stable unique client id per device/tab
export function getClientId(): string {
  try {
    let id = sessionStorage.getItem('dk_client_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('dk_client_id', id);
    }
    return id;
  } catch {
    return 'p_' + Math.random().toString(36).substring(2, 9);
  }
}

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
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  },

  async createRoom(params: {
    roomCode?: string;
    name: string;
    playerClass: string;
    config?: any;
    questions?: any[];
    isSpectator?: boolean;
  }) {
    const clientId = getClientId();
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, clientId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal membuat room.');
    }
    return await res.json();
  },

  async joinRoom(params: {
    roomCode: string;
    name: string;
    playerClass: string;
    isSpectator?: boolean;
  }) {
    const clientId = getClientId();
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, clientId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal bergabung ke room.');
    }
    return await res.json();
  },

  async syncRoom(roomCode: string, sinceEventId: number): Promise<SyncResponse> {
    const res = await fetch(`/api/room/${roomCode}/sync?since=${sinceEventId}`);
    if (!res.ok) {
      throw new Error('Gagal sinkronisasi data room.');
    }
    return await res.json();
  },

  async sendAction(roomCode: string, type: string, payload: any = {}) {
    const playerId = getClientId();
    const res = await fetch(`/api/room/${roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, type, payload })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal mengirim aksi.');
    }
    return await res.json();
  }
};
