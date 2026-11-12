import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  addDoc, 
  query, 
  where,
  orderBy,
  limit,
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testConnection } from './firebase';
import { OnlineRoomData, Player, TaskStation, MatchSummary, GameConfig, Question } from '../types/game';
import { generateRandomizedStations } from '../components/GameScreen';

// Stable unique client id per device/tab
export function getClientId(): string {
  try {
    let id = localStorage.getItem('dk_client_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4);
      localStorage.setItem('dk_client_id', id);
    }
    return id;
  } catch {
    return 'p_' + Math.random().toString(36).substring(2, 9);
  }
}

const PLAYER_COLORS = [
  '#e0463c', '#4aa3df', '#5cb85c', '#f5d547', 
  '#9b59b6', '#e67e22', '#1abc9c', '#e91e63'
];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  impostorsCount: 1,
  crewLives: 3,
  shieldDuration: 3,
  shieldCooldown: 12,
  impostorShotCooldown: 4,
  speedBoostPerTask: 12,
  tasksToWin: 6
};

export function sanitizeConfig(cfg?: Partial<GameConfig> | null): GameConfig {
  return {
    impostorsCount: (cfg && typeof cfg.impostorsCount === 'number' && cfg.impostorsCount > 0) ? cfg.impostorsCount : DEFAULT_GAME_CONFIG.impostorsCount,
    crewLives: (cfg && typeof cfg.crewLives === 'number' && cfg.crewLives > 0) ? cfg.crewLives : DEFAULT_GAME_CONFIG.crewLives,
    shieldDuration: (cfg && typeof cfg.shieldDuration === 'number') ? cfg.shieldDuration : DEFAULT_GAME_CONFIG.shieldDuration,
    shieldCooldown: (cfg && typeof cfg.shieldCooldown === 'number') ? cfg.shieldCooldown : DEFAULT_GAME_CONFIG.shieldCooldown,
    impostorShotCooldown: (cfg && typeof cfg.impostorShotCooldown === 'number') ? cfg.impostorShotCooldown : DEFAULT_GAME_CONFIG.impostorShotCooldown,
    speedBoostPerTask: (cfg && typeof cfg.speedBoostPerTask === 'number') ? cfg.speedBoostPerTask : DEFAULT_GAME_CONFIG.speedBoostPerTask,
    tasksToWin: (cfg && typeof cfg.tasksToWin === 'number' && cfg.tasksToWin > 0) ? cfg.tasksToWin : DEFAULT_GAME_CONFIG.tasksToWin
  };
}

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }
  const cleanObj: any = {};
  for (const [key, value] of Object.entries(obj as any)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj;
}

export const firebaseMultiplayer = {
  /**
   * Check if Firebase is accessible
   */
  async checkHealth(): Promise<boolean> {
    return await testConnection();
  },

  /**
   * Listen to active public rooms
   */
  subscribeActiveRooms(callback: (rooms: Array<{ code: string; hostName: string; playerCount: number; status: string }>) => void): Unsubscribe {
    const roomsCol = collection(db, 'rooms');
    return onSnapshot(roomsCol, async (snapshot) => {
      const roomList: Array<{ code: string; hostName: string; playerCount: number; status: string }> = [];
      const now = Date.now();
      
      for (const d of snapshot.docs) {
        if (d.id === '__connection_test__') continue;
        const data = d.data() as OnlineRoomData;
        // Skip rooms older than 3 hours
        if (data.createdAt && (now - data.createdAt > 3 * 3600 * 1000)) continue;
        
        roomList.push({
          code: data.code,
          hostName: data.hostName || 'Host',
          playerCount: (data as any).playerCount || 1,
          status: data.status || 'lobby'
        });
      }
      callback(roomList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });
  },

  /**
   * Create a new room in Firebase Firestore
   */
  async createRoom(params: {
    roomCode?: string;
    name: string;
    playerClass: string;
    attendanceNumber?: string;
    config?: GameConfig;
    questions?: Question[];
    isSpectator?: boolean;
  }) {
    const clientId = getClientId();
    const finalCode = (params.roomCode && params.roomCode.trim())
      ? params.roomCode.trim().toUpperCase()
      : 'DK' + Math.floor(1000 + Math.random() * 9000);

    const roomRef = doc(db, 'rooms', finalCode);
    const existing = await getDoc(roomRef);
    if (existing.exists()) {
      const roomData = existing.data() as OnlineRoomData;
      if (roomData.status !== 'ended' && roomData.hostId !== clientId) {
        throw new Error(`Kode room ${finalCode} sedang digunakan. Gunakan kode lain atau biarkan kosong.`);
      }
    }

    const roomConfig = sanitizeConfig(params.config);

    const hostPlayer: Player = {
      id: clientId,
      name: params.name.trim() || 'Host',
      playerClass: params.playerClass.trim() || 'Umum',
      attendanceNumber: params.attendanceNumber?.trim() || '',
      role: 'crew',
      color: PLAYER_COLORS[0],
      x: 900,
      y: 750,
      dir: 1,
      hp: roomConfig.crewLives,
      maxHp: roomConfig.crewLives,
      dead: false,
      isMe: true,
      isAI: false,
      isHost: true,
      isSpectator: !!params.isSpectator,
      eliminatedAt: null,
      survivedUntilEnd: false,
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

    const roomData: OnlineRoomData & { playerCount: number; updatedAt: number } = {
      code: finalCode,
      hostId: clientId,
      hostName: params.name.trim() || 'Host',
      status: 'lobby',
      config: roomConfig,
      questions: params.questions || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playerCount: 1
    };

    try {
      await setDoc(roomRef, sanitizeForFirestore(roomData));
      const playerDocRef = doc(db, 'rooms', finalCode, 'players', clientId);
      await setDoc(playerDocRef, sanitizeForFirestore(hostPlayer));

      return {
        room: roomData,
        players: [hostPlayer],
        myPlayer: hostPlayer,
        lastEventId: 0
      };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `rooms/${finalCode}`);
      throw new Error('Gagal membuat room di Firebase. Cek koneksi Anda.');
    }
  },

  /**
   * Join an existing room
   */
  async joinRoom(params: {
    roomCode: string;
    name: string;
    playerClass: string;
    attendanceNumber?: string;
    isSpectator?: boolean;
  }) {
    const clientId = getClientId();
    const cleanCode = (params.roomCode || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Kode room tidak boleh kosong.');

    const roomRef = doc(db, 'rooms', cleanCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error(`Room "${cleanCode}" tidak ditemukan di database.`);
    }

    const roomData = roomSnap.data() as OnlineRoomData;
    const roomConfig = sanitizeConfig(roomData.config);

    // Get current players
    const playersCol = collection(db, 'rooms', cleanCode, 'players');
    const playersSnap = await getDocs(playersCol);
    const existingPlayers: Player[] = [];
    playersSnap.forEach(d => existingPlayers.push(d.data() as Player));

    const isExistingPlayer = existingPlayers.some(p => p.id === clientId);
    if (roomData.status === 'playing' && !params.isSpectator && !isExistingPlayer) {
      throw new Error(`Pertandingan di room "${cleanCode}" sedang berlangsung. Anda bisa bergabung sebagai spektator.`);
    }

    let myPlayer = existingPlayers.find(p => p.id === clientId);

    if (!myPlayer) {
      const colorIndex = existingPlayers.length % PLAYER_COLORS.length;
      myPlayer = {
        id: clientId,
        name: params.name.trim() || 'Siswa',
        playerClass: params.playerClass.trim() || 'Umum',
        attendanceNumber: params.attendanceNumber?.trim() || '',
        role: 'crew',
        color: PLAYER_COLORS[colorIndex],
        x: 880 + (existingPlayers.length * 28) % 180,
        y: 740 + (existingPlayers.length * 20) % 120,
        dir: 1,
        hp: roomConfig.crewLives,
        maxHp: roomConfig.crewLives,
        dead: false,
        isMe: true,
        isAI: false,
        isHost: existingPlayers.length === 0,
        isSpectator: !!params.isSpectator,
        eliminatedAt: null,
        survivedUntilEnd: false,
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

      try {
        await setDoc(doc(db, 'rooms', cleanCode, 'players', clientId), sanitizeForFirestore(myPlayer));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${cleanCode}/players/${clientId}`);
        throw new Error('Gagal mendaftarkan pemain ke dalam room.');
      }

      try {
        await updateDoc(roomRef, {
          playerCount: existingPlayers.length + 1,
          updatedAt: Date.now()
        });
      } catch (err: any) {
        // Non-critical: player doc is already registered
      }

      existingPlayers.push(myPlayer);
    } else {
      // Update nickname or class
      myPlayer.name = params.name.trim() || myPlayer.name;
      myPlayer.playerClass = params.playerClass.trim() || myPlayer.playerClass;
      myPlayer.isSpectator = !!params.isSpectator;
      try {
        await setDoc(doc(db, 'rooms', cleanCode, 'players', clientId), myPlayer, { merge: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${cleanCode}/players/${clientId}`);
      }
    }

    return {
      room: roomData,
      players: existingPlayers,
      myPlayer: { ...myPlayer, isMe: true },
      lastEventId: 0
    };
  },

  /**
   * Listen to real-time room changes (metadata, status, stations)
   */
  subscribeRoom(roomCode: string, callback: (room: OnlineRoomData | null) => void): Unsubscribe {
    const roomRef = doc(db, 'rooms', roomCode);
    return onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as OnlineRoomData);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomCode}`);
    });
  },

  /**
   * Listen to all players in a room in real-time
   */
  subscribePlayers(roomCode: string, myClientId: string, callback: (players: Player[]) => void): Unsubscribe {
    const playersCol = collection(db, 'rooms', roomCode, 'players');
    return onSnapshot(playersCol, (snapshot) => {
      const players: Player[] = [];
      snapshot.forEach(d => {
        const p = d.data() as Player;
        players.push({
          ...p,
          isMe: p.id === myClientId
        });
      });
      callback(players);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomCode}/players`);
    });
  },

  /**
   * Listen to realtime events (bullet fired, chat sent, game events)
   */
  subscribeEvents(roomCode: string, callback: (event: any) => void): Unsubscribe {
    const eventsCol = collection(db, 'rooms', roomCode, 'events');
    const q = query(eventsCol, orderBy('createdAt', 'desc'), limit(15));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomCode}/events`);
    });
  },

  /**
   * Update own player state in Firestore
   */
  /**
   * Update own player state in Firestore
   */
  async updatePlayerState(roomCode: string, playerId: string, updates: Partial<Player>) {
    try {
      const cleanUpdates = sanitizeForFirestore(updates);
      if (Object.keys(cleanUpdates).length === 0) return;
      const playerRef = doc(db, 'rooms', roomCode, 'players', playerId);
      await updateDoc(playerRef, cleanUpdates as any);
    } catch (e) {
      // Handled silently for smooth continuous position updates
    }
  },

  /**
   * Send a game event (chat, bullet, hit, etc.)
   */
  async sendEvent(roomCode: string, eventType: string, payload: any) {
    try {
      const eventsCol = collection(db, 'rooms', roomCode, 'events');
      const eventId = 'ev_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      await setDoc(doc(eventsCol, eventId), sanitizeForFirestore({
        id: eventId,
        type: eventType,
        senderId: getClientId(),
        payload,
        createdAt: Date.now()
      }));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `rooms/${roomCode}/events`);
    }
  },

  /**
   * Synchronize door state in Firestore with timestamp-based conflict resolution and 600ms debounce
   */
  async toggleDoorState(roomCode: string, doorId: string, isOpen: boolean, timestamp: number) {
    try {
      const cleanCode = roomCode.trim().toUpperCase();
      const doorDocRef = doc(db, 'rooms', cleanCode, 'doors', doorId);
      
      const snap = await getDoc(doorDocRef);
      if (snap.exists()) {
        const currentData = snap.data();
        const prevTs = Number(currentData.updatedAt || 0);
        // Ignore conflicting updates within 600ms or older timestamps
        if (timestamp <= prevTs || (timestamp - prevTs < 600 && currentData.isOpen !== isOpen)) {
          return;
        }
      }

      await setDoc(doorDocRef, sanitizeForFirestore({
        doorId,
        isOpen,
        updatedAt: timestamp,
        updatedBy: getClientId()
      }));

      await this.sendEvent(cleanCode, 'toggle_door', {
        doorId,
        isOpen,
        timestamp
      });
    } catch (e) {
      // Silently handled for smooth door sync
    }
  },

  /**
   * Listen to real-time door states from Firestore
   */
  subscribeDoors(roomCode: string, callback: (doors: Record<string, { isOpen: boolean; updatedAt: number }>) => void): Unsubscribe {
    const cleanCode = roomCode.trim().toUpperCase();
    const doorsCol = collection(db, 'rooms', cleanCode, 'doors');
    return onSnapshot(doorsCol, (snapshot) => {
      const doorMap: Record<string, { isOpen: boolean; updatedAt: number }> = {};
      snapshot.forEach(d => {
        const data = d.data();
        if (data && data.doorId) {
          doorMap[data.doorId] = {
            isOpen: !!data.isOpen,
            updatedAt: Number(data.updatedAt || 0)
          };
        }
      });
      callback(doorMap);
    }, (error) => {
      // Silently handled
    });
  },

  /**
   * Host action: Start game, assign roles, and distribute randomized questions
   */
  async startGame(roomCode: string, questionsPool?: Question[], configInput?: GameConfig) {
    const cleanCode = roomCode.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', cleanCode);
    const roomSnap = await getDoc(roomRef);
    const existingRoom = roomSnap.exists() ? (roomSnap.data() as OnlineRoomData) : null;
    const config = sanitizeConfig(configInput && Object.keys(configInput).length > 0 ? configInput : existingRoom?.config);

    const playersCol = collection(db, 'rooms', cleanCode, 'players');
    const playersSnap = await getDocs(playersCol);
    
    const players: Player[] = [];
    playersSnap.forEach(d => players.push(d.data() as Player));

    // If host is alone, auto-add 2 bots so they can test immediately
    const realPlayers = players.filter(p => !p.isSpectator);
    if (realPlayers.length < 2) {
      const bot1Id = 'bot_siswa_1';
      const bot1: Player = {
        id: bot1Id,
        name: 'Siswa Bot Budi',
        playerClass: '7A',
        role: 'crew',
        color: '#4aa3df',
        x: 920,
        y: 760,
        dir: 1,
        hp: config.crewLives,
        maxHp: config.crewLives,
        dead: false,
        isMe: false,
        isAI: true,
        eliminatedAt: null,
        survivedUntilEnd: false,
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
      await setDoc(doc(db, 'rooms', cleanCode, 'players', bot1Id), sanitizeForFirestore(bot1));
      players.push(bot1);
    }

    // Role assignment
    const candidates = players.filter(p => !p.isSpectator);
    const impostorCount = Math.min(config.impostorsCount || 1, Math.max(1, Math.floor(candidates.length / 2)));
    
    // Shuffle candidates
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const impostorIds = new Set(shuffled.slice(0, impostorCount).map(p => p.id));

    // Update each player with assigned role and full HP
    for (const p of players) {
      const isImpostor = impostorIds.has(p.id);
      const updatedData: Partial<Player> = {
        role: isImpostor ? 'impostor' : 'crew',
        hp: config.crewLives,
        maxHp: config.crewLives,
        dead: false,
        doneTasks: 0,
        totalAttempts: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        taskDurations: [],
        completedBitmask: 0,
        lockedStations: {}
      };
      await updateDoc(doc(db, 'rooms', cleanCode, 'players', p.id), sanitizeForFirestore(updatedData) as any);
    }

    // Generate randomized stations distributed across rooms
    const stationCount = Math.max(config.tasksToWin, 8);
    const stations: TaskStation[] = generateRandomizedStations(stationCount);

    // Select randomized questions
    let finalQuestions = questionsPool && questionsPool.length > 0 ? questionsPool : (existingRoom?.questions || []);
    if (finalQuestions.length > config.tasksToWin) {
      finalQuestions = [...finalQuestions].sort(() => Math.random() - 0.5).slice(0, Math.max(config.tasksToWin, 6));
    }

    // Update room status
    await updateDoc(roomRef, sanitizeForFirestore({
      status: 'playing',
      stations,
      questions: finalQuestions,
      config,
      startedAt: Date.now(),
      updatedAt: Date.now()
    }) as any);

    // Send game_started event
    await this.sendEvent(cleanCode, 'game_started', {
      startedAt: Date.now()
    });
  },

  /**
   * Add bot player to lobby
   */
  async addBot(roomCode: string, configInput?: GameConfig) {
    const cleanCode = roomCode.trim().toUpperCase();
    const roomRef = doc(db, 'rooms', cleanCode);
    const roomSnap = await getDoc(roomRef);
    const existingRoom = roomSnap.exists() ? (roomSnap.data() as OnlineRoomData) : null;
    const config = sanitizeConfig(configInput && Object.keys(configInput).length > 0 ? configInput : existingRoom?.config);

    const botNum = Math.floor(Math.random() * 900 + 100);
    const botId = `bot_${botNum}`;
    const botNames = ['Budi', 'Rani', 'Siti', 'Dimas', 'Adit', 'Maya', 'Fajar', 'Dewi', 'Reza'];
    const chosenName = botNames[Math.floor(Math.random() * botNames.length)] + ` (Bot #${botNum % 50})`;

    const botPlayer: Player = {
      id: botId,
      name: chosenName,
      playerClass: '7A',
      role: 'crew',
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      x: 880 + Math.random() * 80,
      y: 750 + Math.random() * 80,
      dir: 1,
      hp: config.crewLives,
      maxHp: config.crewLives,
      dead: false,
      isMe: false,
      isAI: true,
      eliminatedAt: null,
      survivedUntilEnd: false,
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

    await setDoc(doc(db, 'rooms', cleanCode, 'players', botId), sanitizeForFirestore(botPlayer));
  },

  /**
   * Clear AI bots from room
   */
  async clearBots(roomCode: string) {
    const cleanCode = roomCode.trim().toUpperCase();
    const playersCol = collection(db, 'rooms', cleanCode, 'players');
    const snap = await getDocs(playersCol);
    for (const d of snap.docs) {
      const p = d.data() as Player;
      if (p.isAI) {
        await deleteDoc(d.ref);
      }
    }
  },

  /**
   * Leave room
   */
  async leaveRoom(roomCode: string, playerId: string) {
    try {
      const cleanCode = roomCode.trim().toUpperCase();
      await deleteDoc(doc(db, 'rooms', cleanCode, 'players', playerId));
    } catch {}
  },

  /**
   * Return room to lobby
   */
  async returnToLobby(roomCode: string) {
    const cleanCode = roomCode.trim().toUpperCase();
    await updateDoc(doc(db, 'rooms', cleanCode), {
      status: 'lobby',
      updatedAt: Date.now()
    });
    await this.sendEvent(cleanCode, 'returned_to_lobby', {});
  }
};
