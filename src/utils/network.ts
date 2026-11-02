import { OnlineRoomData, Player, TaskStation, MatchSummary } from '../types/game';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/health', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      return !!(data && data.status === 'ok');
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
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify({ ...params, clientId }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        // Save copy to local storage for local cross-tab sync resilience
        try {
          localStorage.setItem('dk_active_room_' + data.room.code, JSON.stringify(data));
        } catch {}
        return data;
      }
      
      const err = await res.json().catch(() => ({}));
      if (err.error) throw new Error(err.error);
    } catch (e: any) {
      console.warn('Backend createRoom fallback engaged:', e.message);
    }

    // Resilient fallback: create valid local room session so player is NEVER blocked
    const fallbackCode = (params.roomCode || 'DK' + Math.floor(1000 + Math.random() * 9000)).trim().toUpperCase().slice(0, 10);
    const hostPlayer: Player = {
      id: clientId,
      name: (params.name || 'Guru').trim().slice(0, 16),
      playerClass: (params.playerClass || 'Umum').trim().slice(0, 16),
      role: 'crew',
      color: '#4aa3df',
      x: 900,
      y: 450,
      dir: 1,
      hp: params.config?.crewLives || 3,
      maxHp: params.config?.crewLives || 3,
      dead: false,
      isMe: true,
      isAI: false,
      isHost: true,
      isSpectator: !!params.isSpectator,
      eliminatedAt: null,
      survivedUntilEnd: true,
      doneTasks: 0,
      totalAttempts: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      taskDurations: [],
      shieldEndTime: 0,
      shieldCooldownUntil: 0,
      invulnerableUntil: 0,
      freezeUntil: 0,
      workUntil: 0,
      completedBitmask: 0,
      lockedStations: {}
    };

    const fallbackRoom: OnlineRoomData = {
      code: fallbackCode,
      hostId: clientId,
      hostName: hostPlayer.name,
      status: 'lobby',
      config: params.config || {
        impostorsCount: 2,
        crewLives: 3,
        shieldDuration: 3,
        shieldCooldown: 12,
        impostorShotCooldown: 4,
        speedBoostPerTask: 12,
        tasksToWin: 6
      },
      questions: params.questions && params.questions.length > 0 ? params.questions : DEFAULT_QUESTIONS,
      createdAt: Date.now()
    };

    const fallbackResult = {
      status: 'ok',
      room: fallbackRoom,
      myPlayer: hostPlayer,
      players: [hostPlayer],
      lastEventId: 1
    };

    try {
      localStorage.setItem('dk_active_room_' + fallbackCode, JSON.stringify(fallbackResult));
    } catch {}

    return fallbackResult;
  },

  async joinRoom(params: {
    roomCode: string;
    name: string;
    playerClass: string;
    isSpectator?: boolean;
  }) {
    const clientId = getClientId();
    const cleanCode = (params.roomCode || '').trim().toUpperCase();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify({ ...params, roomCode: cleanCode, clientId }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      if (err.error) throw new Error(err.error);
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Network')) {
        throw e;
      }
    }

    // Local fallback check (for same-device cross-tab testing)
    try {
      const saved = localStorage.getItem('dk_active_room_' + cleanCode);
      if (saved) {
        const parsed = JSON.parse(saved);
        const joinPlayer: Player = {
          id: clientId,
          name: (params.name || 'Siswa').trim().slice(0, 16),
          playerClass: (params.playerClass || 'Umum').trim().slice(0, 16),
          role: 'crew',
          color: '#e8a33d',
          x: 900,
          y: 750,
          dir: 1,
          hp: parsed.room.config.crewLives || 3,
          maxHp: parsed.room.config.crewLives || 3,
          dead: false,
          isMe: true,
          isAI: false,
          isHost: false,
          isSpectator: !!params.isSpectator,
          eliminatedAt: null,
          survivedUntilEnd: true,
          doneTasks: 0,
          totalAttempts: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          taskDurations: [],
          shieldEndTime: 0,
          shieldCooldownUntil: 0,
          invulnerableUntil: 0,
          freezeUntil: 0,
          workUntil: 0,
          completedBitmask: 0,
          lockedStations: {}
        };
        const updatedPlayers = [...(parsed.players || []).filter((p: Player) => p.id !== clientId), joinPlayer];
        parsed.players = updatedPlayers;
        localStorage.setItem('dk_active_room_' + cleanCode, JSON.stringify(parsed));
        return {
          status: 'ok',
          room: parsed.room,
          myPlayer: joinPlayer,
          players: updatedPlayers,
          lastEventId: (parsed.lastEventId || 0) + 1
        };
      }
    } catch {}

    throw new Error(`Room "${cleanCode}" tidak ditemukan atau jaringan terganggu. Silakan periksa kembali kode room.`);
  },

  async syncRoom(roomCode: string, sinceEventId: number): Promise<SyncResponse> {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`/api/room/${cleanCode}/sync?since=${sinceEventId}`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    // Resilient local sync fallback
    try {
      const saved = localStorage.getItem('dk_active_room_' + cleanCode);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          status: parsed.room.status || 'lobby',
          room: parsed.room,
          players: parsed.players || [],
          stations: parsed.stations || [],
          events: [],
          lastEventId: parsed.lastEventId || 0,
          summary: parsed.summary || null
        };
      }
    } catch {}

    throw new Error('Gagal sinkronisasi data room.');
  },

  async sendAction(roomCode: string, type: string, payload: any = {}) {
    const playerId = getClientId();
    const cleanCode = (roomCode || '').trim().toUpperCase();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`/api/room/${cleanCode}/action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify({ playerId, type, payload }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    // Local action state update
    try {
      const saved = localStorage.getItem('dk_active_room_' + cleanCode);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (type === 'start_game') {
          parsed.room.status = 'playing';
          localStorage.setItem('dk_active_room_' + cleanCode, JSON.stringify(parsed));
        }
        return { status: 'ok' };
      }
    } catch {}

    return { status: 'ok' };
  }
};
