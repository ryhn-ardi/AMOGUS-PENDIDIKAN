import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  Player, 
  GameConfig, 
  Question, 
  TaskStation, 
  MatchSummary, 
  OnlineRoomData 
} from './src/types/game.ts';
import { DEFAULT_QUESTIONS } from './src/data/defaultQuestions.ts';
import { calculateLeaderboard } from './src/utils/leaderboard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
// The internal app server always listens on port 3000 (nginx forwards 8080 to 3000)
const PORT = 3000;

const app = express();
app.use(express.json());

// Enable CORS and disable caching on API routes
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const httpServer = createHttpServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Spawn points
const CP: [number, number][] = [
  [900, 450], [900, 750], [780, 450], [1020, 450],
  [780, 750], [1020, 750], [900, 520], [900, 680], [840, 600], [960, 600]
];
const IP: [number, number][] = [
  [100, 100], [1700, 1100], [1700, 100], [100, 1100]
];
const CREW_COLORS = ["#4aa3df", "#e8a33d", "#b57edc", "#5cc98a", "#4dd0c4", "#f08ca8", "#8fb4ff", "#c5e063"];

const SP6: [number, number][] = [
  [300, 300], [900, 300], [1500, 300],
  [300, 900], [900, 900], [1500, 900]
];
const SP12: [number, number][] = SP6.flatMap(p => [
  [p[0] - 130, p[1]],
  [p[0] + 130, p[1]]
]);

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  roomCode: string | null;
}

interface RoomEvent {
  id: number;
  type: string;
  payload: any;
  timestamp: number;
}

interface RoomState {
  code: string;
  hostId: string;
  hostName: string;
  status: 'lobby' | 'playing' | 'ended';
  config: GameConfig;
  questions: Question[];
  createdAt: number;
  gameStartTime: number;
  players: Map<string, Player>;
  stations: TaskStation[];
  events: RoomEvent[];
  lastEventId: number;
  matchSummary?: MatchSummary | null;
  lastActive: number;
}

const rooms = new Map<string, RoomState>();
const clients = new Map<WebSocket, ConnectedClient>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function pushRoomEvent(room: RoomState, type: string, payload: any) {
  room.lastEventId++;
  const event: RoomEvent = {
    id: room.lastEventId,
    type,
    payload,
    timestamp: Date.now()
  };
  room.events.push(event);
  if (room.events.length > 80) {
    room.events.shift();
  }
  room.lastActive = Date.now();

  // Also broadcast to WebSocket clients connected to this room
  broadcastToRoom(room, {
    type,
    ...payload,
    eventId: event.id
  });
}

function broadcastToRoom(room: RoomState, message: any, excludeWs?: WebSocket) {
  const json = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.roomCode === room.code && client.ws.readyState === WebSocket.OPEN) {
      if (excludeWs && client.ws === excludeWs) continue;
      client.ws.send(json);
    }
  }
}

function getSanitizedRoomData(room: RoomState): OnlineRoomData {
  return {
    code: room.code,
    hostId: room.hostId,
    hostName: room.hostName,
    status: room.status,
    config: room.config,
    questions: room.questions,
    createdAt: room.createdAt
  };
}

function checkRoomVictory(room: RoomState): MatchSummary | null {
  if (room.status !== 'playing') return null;

  const now = performance.now();
  const matchDuration = Math.max(1, Math.round((now - room.gameStartTime) / 1000));
  const playerList = Array.from(room.players.values()).filter(p => !p.isSpectator);
  
  const survivingCrew = playerList.filter(p => p.role === 'crew' && !p.dead);
  const survivingImps = playerList.filter(p => p.role === 'impostor' && !p.dead);
  const totalCrew = playerList.filter(p => p.role === 'crew');
  const totalImps = playerList.filter(p => p.role === 'impostor');

  let winnerTeam: 'crew' | 'impostor' | null = null;
  let winnerTitle = '';
  let reason = '';

  // Kondisi 1: SEMUA PENYUSUP GUGUR -> Kru Menang!
  if (survivingImps.length === 0 && totalImps.length > 0) {
    winnerTeam = 'crew';
    winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
    reason = `Semua penyusup tertangkap! Kru yang tersisa (${survivingCrew.length}/${totalCrew.length} siswa) berhasil mempertahankan sekolah hingga titik akhir.`;
  }
  // Kondisi 2: SEMUA SISWA (SURVIVOR) YANG TERSISA SUDAH MENJAWAB SEMUA SOAL -> Kru Menang!
  else if (survivingCrew.length > 0) {
    const allSurvivorsFinished = survivingCrew.every(c => c.doneTasks >= room.config.tasksToWin);
    if (allSurvivorsFinished) {
      winnerTeam = 'crew';
      winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
      reason = `Seluruh siswa detektif yang bertahan (${survivingCrew.length} siswa) berhasil menyelesaikan semua soal tantangan (${room.config.tasksToWin} soal/siswa)! Alarm keamanan sekolah telah aktif.`;
    }
  }

  // Kondisi 3: PENYUSUP (IMPOSTOR) MENANG
  // Sesuai rules: ketika berhasil membunuh SEMUA survivor DAN mengerjakan semua soal!
  if (!winnerTeam && survivingCrew.length === 0 && totalCrew.length > 0) {
    const impDone = totalImps.some(imp => imp.doneTasks >= room.config.tasksToWin) ||
      totalImps.reduce((acc, imp) => acc + imp.doneTasks, 0) >= room.config.tasksToWin;

    if (impDone) {
      winnerTeam = 'impostor';
      winnerTitle = '🚨 TIM PENYUSUP MENANG!';
      reason = `Penyusup berhasil mengeliminasi semua siswa detektif DAN telah menyelesaikan seluruh soal tugas sekolah (${room.config.tasksToWin} soal)! Misi penyusup tuntas sempurna.`;
    }
  }

  if (winnerTeam) {
    room.status = 'ended';
    const leaderboard = calculateLeaderboard(playerList, matchDuration);
    const summary: MatchSummary = {
      id: 'match-' + Date.now(),
      date: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      winnerTeam,
      winnerTitle,
      reason,
      survivingCrewCount: survivingCrew.length,
      totalCrewCount: totalCrew.length,
      survivingImpostorCount: survivingImps.length,
      totalImpostorCount: totalImps.length,
      matchDuration,
      leaderboard
    };
    room.matchSummary = summary;
    return summary;
  }

  return null;
}

// REST API Endpoints (Fully functional with or without WebSocket)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), roomsCount: rooms.size });
});

app.get('/api/rooms', (req, res) => {
  const activeRooms = Array.from(rooms.values()).map(r => ({
    code: r.code,
    hostName: r.hostName,
    playerCount: r.players.size,
    status: r.status,
    createdAt: r.createdAt
  }));
  res.json({ rooms: activeRooms });
});

app.post('/api/room/create', (req, res) => {
  try {
    const { roomCode, name, playerClass, config, questions, isSpectator, clientId } = req.body;
    const rawCode = (roomCode || generateRoomCode()).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = rawCode.slice(0, 10) || generateRoomCode();
    const hostName = (name || 'Guru').trim().slice(0, 16);
    const pClass = (playerClass || 'Umum').trim().slice(0, 16);
    const pid = clientId || 'p_' + Math.random().toString(36).substring(2, 9);

    const defaultConfig: GameConfig = {
      impostorsCount: 2,
      crewLives: 3,
      shieldDuration: 3,
      shieldCooldown: 12,
      impostorShotCooldown: 4,
      speedBoostPerTask: 12,
      tasksToWin: 6
    };

    const room: RoomState = {
      code,
      hostId: pid,
      hostName,
      status: 'lobby',
      config: config || defaultConfig,
      questions: Array.isArray(questions) && questions.length > 0 ? questions : DEFAULT_QUESTIONS,
      createdAt: Date.now(),
      gameStartTime: 0,
      players: new Map(),
      stations: [],
      events: [],
      lastEventId: 0,
      lastActive: Date.now()
    };

    const hostPlayer: Player = {
      id: pid,
      name: hostName,
      playerClass: pClass,
      role: 'crew',
      color: CREW_COLORS[0],
      x: CP[0][0],
      y: CP[0][1],
      dir: 1,
      hp: room.config.crewLives,
      maxHp: room.config.crewLives,
      dead: false,
      isMe: true,
      isAI: false,
      isHost: true,
      isSpectator: !!isSpectator,
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

    room.players.set(pid, hostPlayer);
    rooms.set(code, room);

    pushRoomEvent(room, 'player_joined', {
      player: hostPlayer,
      players: Array.from(room.players.values()),
      message: `${hostName} (${pClass}) membuat room.`
    });

    res.json({
      status: 'ok',
      room: getSanitizedRoomData(room),
      myPlayer: hostPlayer,
      players: Array.from(room.players.values()),
      lastEventId: room.lastEventId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/room/join', (req, res) => {
  try {
    const { roomCode, name, playerClass, isSpectator, clientId } = req.body;
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return res.status(404).json({ error: `Room "${code}" tidak ditemukan. Pastikan kode room benar.` });
    }

    if (room.status === 'playing' && !isSpectator) {
      return res.status(400).json({ error: `Pertandingan di Room "${code}" sedang berlangsung. Masuklah sebagai spektator.` });
    }

    const playerName = (name || 'Siswa').trim().slice(0, 16);
    const pClass = (playerClass || 'Umum').trim().slice(0, 16);
    const pid = clientId || 'p_' + Math.random().toString(36).substring(2, 9);
    const colorIdx = room.players.size % CREW_COLORS.length;

    let existing = room.players.get(pid);
    if (!existing) {
      existing = {
        id: pid,
        name: playerName,
        playerClass: pClass,
        role: 'crew',
        color: CREW_COLORS[colorIdx],
        x: CP[colorIdx % CP.length][0],
        y: CP[colorIdx % CP.length][1],
        dir: 1,
        hp: room.config.crewLives,
        maxHp: room.config.crewLives,
        dead: false,
        isMe: true,
        isAI: false,
        isHost: false,
        isSpectator: !!isSpectator,
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
      room.players.set(pid, existing);

      pushRoomEvent(room, 'player_joined', {
        player: existing,
        players: Array.from(room.players.values()),
        message: `${playerName} (${pClass}) bergabung ke room!`
      });
    }

    res.json({
      status: 'ok',
      room: getSanitizedRoomData(room),
      myPlayer: existing,
      players: Array.from(room.players.values()),
      lastEventId: room.lastEventId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Periodic HTTP Sync endpoint for real-time room updates
app.get('/api/room/:code/sync', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const sinceId = Number(req.query.since || 0);
  const newEvents = room.events.filter(e => e.id > sinceId);

  res.json({
    status: room.status,
    room: getSanitizedRoomData(room),
    players: Array.from(room.players.values()),
    stations: room.stations,
    events: newEvents,
    lastEventId: room.lastEventId,
    summary: room.matchSummary || null
  });
});

// Universal Action endpoint (handles move, shoot, shield, task, hit, chat)
app.post('/api/room/:code/action', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { playerId, type, payload } = req.body;
  const player = playerId ? room.players.get(playerId) : null;
  const isHost = !playerId || room.hostId === playerId || player?.isHost || room.players.size <= 1;

  if (type === 'add_bot' && isHost) {
    const botIdx = room.players.size;
    const botNames = ['Rani (Bot)', 'Budi (Bot)', 'Dimas (Bot)', 'Sari (Bot)', 'Alya (Bot)', 'Reza (Bot)'];
    const botClasses = ['7A', '7B', '8A', '8B', '9A'];
    const botName = botNames[botIdx % botNames.length];
    const botClass = botClasses[botIdx % botClasses.length];
    const botId = 'bot_' + Math.random().toString(36).substring(2, 7);
    const colorIdx = room.players.size % CREW_COLORS.length;

    const botPlayer: Player = {
      id: botId,
      name: botName,
      playerClass: botClass,
      role: 'crew',
      color: CREW_COLORS[colorIdx],
      x: CP[colorIdx % CP.length][0],
      y: CP[colorIdx % CP.length][1],
      dir: 1,
      hp: room.config.crewLives,
      maxHp: room.config.crewLives,
      dead: false,
      isMe: false,
      isAI: true,
      isHost: false,
      isSpectator: false,
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

    room.players.set(botId, botPlayer);
    pushRoomEvent(room, 'player_joined', {
      player: botPlayer,
      players: Array.from(room.players.values()),
      message: `${botName} (${botClass}) bergabung sebagai bot latihan.`
    });
    return res.json({ status: 'ok', players: Array.from(room.players.values()) });
  }

  if (type === 'clear_bots' && isHost) {
    for (const [id, p] of room.players.entries()) {
      if (p.isAI) room.players.delete(id);
    }
    pushRoomEvent(room, 'player_left', {
      players: Array.from(room.players.values()),
      message: 'Semua bot telah dikeluarkan dari lobi.'
    });
    return res.json({ status: 'ok', players: Array.from(room.players.values()) });
  }

  if (type === 'start_game') {
    if (!isHost) {
      return res.status(403).json({ error: 'Hanya host yang dapat memulai game' });
    }
    let activePlayers = Array.from(room.players.values()).filter(p => !p.isSpectator);
    
    // Auto-fill dengan Bot jika pemain kurang dari 4 (memudahkan pengujian instan)
    if (activePlayers.length < 4) {
      const needed = 4 - activePlayers.length;
      const botNames = ['Rani (Bot)', 'Budi (Bot)', 'Dimas (Bot)', 'Bayangan (Bot)'];
      const botClasses = ['7A', '7B', '8A', 'Penyusup'];
      for (let b = 0; b < needed; b++) {
        const botId = 'bot_' + Math.random().toString(36).substring(2, 7);
        const colorIdx = room.players.size % CREW_COLORS.length;
        const botPlayer: Player = {
          id: botId,
          name: botNames[b % botNames.length],
          playerClass: botClasses[b % botClasses.length],
          role: 'crew',
          color: CREW_COLORS[colorIdx],
          x: CP[colorIdx % CP.length][0],
          y: CP[colorIdx % CP.length][1],
          dir: 1,
          hp: room.config.crewLives,
          maxHp: room.config.crewLives,
          dead: false,
          isMe: false,
          isAI: true,
          isHost: false,
          isSpectator: false,
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
        room.players.set(botId, botPlayer);
      }
      activePlayers = Array.from(room.players.values()).filter(p => !p.isSpectator);
    }

    const shuffledIds = activePlayers.map(p => p.id).sort(() => Math.random() - 0.5);
    const numImps = Math.min(room.config.impostorsCount, Math.max(1, Math.floor(activePlayers.length / 3)));
    const impIds = new Set(shuffledIds.slice(0, numImps));

    let crewIdx = 0;
    let impIdx = 0;

    for (const p of room.players.values()) {
      p.dead = false;
      p.hp = room.config.crewLives;
      p.doneTasks = 0;
      p.correctAnswers = 0;
      p.wrongAnswers = 0;
      p.totalAttempts = 0;
      p.taskDurations = [];
      p.completedBitmask = 0;
      p.lockedStations = {};
      p.eliminatedAt = null;

      if (p.isSpectator) continue;

      if (impIds.has(p.id)) {
        p.role = 'impostor';
        p.color = '#e0463c';
        p.x = IP[impIdx % IP.length][0];
        p.y = IP[impIdx % IP.length][1];
        impIdx++;
      } else {
        p.role = 'crew';
        p.color = CREW_COLORS[crewIdx % CREW_COLORS.length];
        p.x = CP[crewIdx % CP.length][0];
        p.y = CP[crewIdx % CP.length][1];
        crewIdx++;
      }
    }

    const stationSpots = activePlayers.length >= 6 ? SP12 : SP6;
    room.stations = stationSpots.map((p, i) => ({
      i,
      x: p[0],
      y: p[1],
      roomIndex: Math.min(2, Math.floor(p[0] / 600)) + (p[1] >= 600 ? 3 : 0)
    }));

    room.status = 'playing';
    room.gameStartTime = performance.now();
    room.matchSummary = null;

    pushRoomEvent(room, 'game_started', {
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values()),
      stations: room.stations,
      gameStartTime: room.gameStartTime
    });

    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'player_update' && player) {
    if (typeof payload.x === 'number') player.x = payload.x;
    if (typeof payload.y === 'number') player.y = payload.y;
    if (typeof payload.dir === 'number') player.dir = payload.dir;
    if (typeof payload.angle === 'number') player.angle = payload.angle;
    if (typeof payload.workUntil === 'number') player.workUntil = payload.workUntil;
    if (typeof payload.shieldEndTime === 'number') player.shieldEndTime = payload.shieldEndTime;

    // Broadcast position update to WebSocket peers immediately
    broadcastToRoom(room, {
      type: 'player_moved',
      playerId: player.id,
      x: player.x,
      y: player.y,
      dir: player.dir,
      angle: player.angle,
      workUntil: player.workUntil,
      shieldEndTime: player.shieldEndTime
    });

    return res.json({ status: 'ok' });
  }

  if (type === 'use_shield' && player && player.role === 'crew') {
    const now = (performance.now() - room.gameStartTime) / 1000;
    player.shieldEndTime = now + room.config.shieldDuration;
    player.shieldCooldownUntil = now + Math.max(room.config.shieldCooldown, room.config.shieldDuration);

    pushRoomEvent(room, 'shield_used', {
      playerId: player.id,
      shieldEndTime: player.shieldEndTime,
      shieldCooldownUntil: player.shieldCooldownUntil
    });
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'shoot_bullet' && player && player.role === 'impostor') {
    pushRoomEvent(room, 'bullet_fired', {
      shooterId: player.id,
      x: player.x,
      y: player.y,
      angle: payload.angle || player.angle || 0
    });
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'task_completed' && player) {
    const stationIndex = payload.stationIndex;
    const duration = payload.duration || 3.0;

    player.doneTasks++;
    player.correctAnswers++;
    player.totalAttempts++;
    player.taskDurations.push(duration);
    if (typeof stationIndex === 'number') {
      player.completedBitmask |= (1 << stationIndex);
    }

    pushRoomEvent(room, 'task_progress', {
      playerId: player.id,
      doneTasks: player.doneTasks,
      correctAnswers: player.correctAnswers,
      totalAttempts: player.totalAttempts,
      completedBitmask: player.completedBitmask,
      message: `${player.name} (${player.playerClass}) berhasil menyelesaikan soal!`
    });

    const victory = checkRoomVictory(room);
    if (victory) {
      pushRoomEvent(room, 'game_over', { summary: victory });
    }
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'task_failed' && player) {
    player.wrongAnswers++;
    player.totalAttempts++;
    if (typeof payload.stationIndex === 'number') {
      const now = (performance.now() - room.gameStartTime) / 1000;
      player.lockedStations[payload.stationIndex] = now + 6;
    }

    pushRoomEvent(room, 'task_failed', {
      playerId: player.id,
      wrongAnswers: player.wrongAnswers,
      totalAttempts: player.totalAttempts
    });
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'player_hit' && player && player.role === 'crew') {
    if (player.dead) return res.json({ status: 'ok' });

    player.hp--;
    if (player.hp <= 0) {
      player.dead = true;
      const gameTime = Math.max(1, (performance.now() - room.gameStartTime) / 1000);
      player.eliminatedAt = gameTime;

      pushRoomEvent(room, 'player_eliminated', {
        playerId: player.id,
        name: player.name,
        playerClass: player.playerClass,
        eliminatedAt: gameTime,
        message: `${player.name} (${player.playerClass}) tertangkap oleh penyusup!`
      });
    } else {
      pushRoomEvent(room, 'player_damaged', {
        playerId: player.id,
        hp: player.hp,
        message: `${player.name} terkena serangan! (Nyawa: ${player.hp})`
      });
    }

    const victory = checkRoomVictory(room);
    if (victory) {
      pushRoomEvent(room, 'game_over', { summary: victory });
    }
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'chat_message' && player) {
    const text = String(payload.text || '').trim().slice(0, 80);
    if (text) {
      pushRoomEvent(room, 'chat_broadcast', {
        senderName: player.name,
        senderClass: player.playerClass,
        senderColor: player.color,
        text,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
    }
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'return_to_lobby' && room.hostId === playerId) {
    room.status = 'lobby';
    room.matchSummary = null;
    for (const p of room.players.values()) {
      p.dead = false;
      p.hp = room.config.crewLives;
      p.doneTasks = 0;
      p.correctAnswers = 0;
      p.wrongAnswers = 0;
      p.totalAttempts = 0;
      p.taskDurations = [];
      p.completedBitmask = 0;
      p.lockedStations = {};
      p.eliminatedAt = null;
    }

    pushRoomEvent(room, 'returned_to_lobby', {
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values())
    });
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  if (type === 'leave_room') {
    room.players.delete(playerId);
    if (room.players.size === 0) {
      rooms.delete(room.code);
      return res.json({ status: 'ok' });
    }

    if (room.hostId === playerId) {
      const nextPlayer = room.players.values().next().value;
      if (nextPlayer) {
        room.hostId = nextPlayer.id;
        room.hostName = nextPlayer.name;
        nextPlayer.isHost = true;
      }
    }

    pushRoomEvent(room, 'player_left', {
      playerId,
      name: player?.name,
      playerClass: player?.playerClass,
      players: Array.from(room.players.values()),
      newHostId: room.hostId,
      message: `${player?.name || 'Pemain'} keluar dari room.`
    });

    if (room.status === 'playing') {
      const victory = checkRoomVictory(room);
      if (victory) {
        pushRoomEvent(room, 'game_over', { summary: victory });
      }
    }
    return res.json({ status: 'ok', lastEventId: room.lastEventId });
  }

  res.json({ status: 'ignored' });
});

// WebSocket Protocol handling
wss.on('connection', (ws) => {
  const clientId = 'c_' + Math.random().toString(36).substring(2, 9);
  const client: ConnectedClient = { ws, id: clientId, roomCode: null };
  clients.set(ws, client);

  ws.send(JSON.stringify({ type: 'connected', clientId }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.roomCode) client.roomCode = msg.roomCode;
      // Also map client message to room event handling
      const room = client.roomCode ? rooms.get(client.roomCode) : null;
      if (room && msg.type === 'player_update') {
        const player = room.players.get(client.id);
        if (player) {
          if (typeof msg.x === 'number') player.x = msg.x;
          if (typeof msg.y === 'number') player.y = msg.y;
          if (typeof msg.dir === 'number') player.dir = msg.dir;
          if (typeof msg.angle === 'number') player.angle = msg.angle;
          if (typeof msg.workUntil === 'number') player.workUntil = msg.workUntil;
          if (typeof msg.shieldEndTime === 'number') player.shieldEndTime = msg.shieldEndTime;

          broadcastToRoom(room, {
            type: 'player_moved',
            playerId: player.id,
            x: player.x,
            y: player.y,
            dir: player.dir,
            angle: player.angle,
            workUntil: player.workUntil,
            shieldEndTime: player.shieldEndTime
          }, ws);
        }
      }
    } catch (e) {
      console.error('Error in WS message', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Full-Stack Server Mounting (Vite middlewares in dev, static in prod)
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Detektif Kelas Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
