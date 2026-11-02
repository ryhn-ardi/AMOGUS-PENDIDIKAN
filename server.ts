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
  GameBullet, 
  MatchSummary, 
  OnlineRoomData 
} from './src/types/game.ts';
import { DEFAULT_QUESTIONS } from './src/data/defaultQuestions.ts';
import { calculateLeaderboard } from './src/utils/leaderboard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());

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

  // Kondisi 1: SEMUA KRU GUGUR (Kru yang tersisa = 0) -> Tim Penyusup Menang!
  if (survivingCrew.length === 0 && totalCrew.length > 0) {
    winnerTeam = 'impostor';
    winnerTitle = '🚨 TIM PENYUSUP MENANG!';
    reason = `Semua kru tertangkap! Tidak ada detektif kru yang tersisa (${survivingCrew.length}/${totalCrew.length} kru). Penyusup berhasil menguasai sekolah.`;
  }
  // Kondisi 2: SEMUA PENYUSUP GUGUR (Penyusup yang tersisa = 0) -> Tim Kru Menang!
  else if (survivingImps.length === 0 && totalImps.length > 0) {
    winnerTeam = 'crew';
    winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
    reason = `Semua penyusup tertangkap! Kru yang tersisa (${survivingCrew.length}/${totalCrew.length} siswa) berhasil mempertahankan sekolah hingga titik akhir.`;
  }
  // Kondisi 3: KRU SELESAIKAN SEMUA TUGAS KUIS
  else if (survivingCrew.length > 0) {
    const anySoloWon = survivingCrew.some(c => c.doneTasks >= room.config.tasksToWin);
    const totalDone = survivingCrew.reduce((acc, c) => acc + c.doneTasks, 0);
    const targetCollective = Math.max(1, totalCrew.length * (room.config.tasksToWin - 1));

    if (anySoloWon || (totalCrew.length > 1 && totalDone >= targetCollective)) {
      winnerTeam = 'crew';
      winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
      reason = `Tugas kuis sekolah berhasil diselesaikan! Detektif kru yang tersisa (${survivingCrew.length} siswa) berhasil mengaktifkan alarm keamanan.`;
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
    return summary;
  }

  return null;
}

// REST API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
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

// WebSocket Protocol
wss.on('connection', (ws) => {
  const clientId = 'c_' + Math.random().toString(36).substring(2, 9);
  const client: ConnectedClient = { ws, id: clientId, roomCode: null };
  clients.set(ws, client);

  ws.send(JSON.stringify({ type: 'connected', clientId }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleClientMessage(client, msg);
    } catch (e) {
      console.error('Error parsing client message', e);
    }
  });

  ws.on('close', () => {
    handleClientDisconnect(client);
    clients.delete(ws);
  });
});

function handleClientMessage(client: ConnectedClient, msg: any) {
  const { type } = msg;

  // 1. Create Room
  if (type === 'create_room') {
    const rawCode = (msg.roomCode || generateRoomCode()).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = rawCode.slice(0, 10) || generateRoomCode();
    const hostName = (msg.name || 'Guru').trim().slice(0, 16);
    const playerClass = (msg.playerClass || 'Umum').trim().slice(0, 16);

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
      hostId: client.id,
      hostName,
      status: 'lobby',
      config: msg.config || defaultConfig,
      questions: Array.isArray(msg.questions) && msg.questions.length > 0 ? msg.questions : DEFAULT_QUESTIONS,
      createdAt: Date.now(),
      gameStartTime: 0,
      players: new Map(),
      stations: []
    };

    const hostPlayer: Player = {
      id: client.id,
      name: hostName,
      playerClass,
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
      isSpectator: !!msg.isSpectator,
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

    room.players.set(client.id, hostPlayer);
    rooms.set(code, room);
    client.roomCode = code;

    client.ws.send(JSON.stringify({
      type: 'room_created',
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values()),
      myPlayer: hostPlayer
    }));
    return;
  }

  // 2. Join Room
  if (type === 'join_room') {
    const code = (msg.roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Room "${code}" tidak ditemukan. Pastikan kode room benar.`
      }));
      return;
    }

    if (room.status === 'playing' && !msg.isSpectator) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `Pertandingan di Room "${code}" sedang berlangsung. Anda bisa bergabung sebagai spektator.`
      }));
      return;
    }

    const name = (msg.name || 'Siswa').trim().slice(0, 16);
    const playerClass = (msg.playerClass || '-').trim().slice(0, 16);
    const colorIdx = room.players.size % CREW_COLORS.length;

    const newPlayer: Player = {
      id: client.id,
      name,
      playerClass,
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
      isSpectator: !!msg.isSpectator,
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

    room.players.set(client.id, newPlayer);
    client.roomCode = code;

    client.ws.send(JSON.stringify({
      type: 'room_joined',
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values()),
      myPlayer: newPlayer
    }));

    broadcastToRoom(room, {
      type: 'player_joined',
      player: newPlayer,
      players: Array.from(room.players.values()),
      message: `${name} (${playerClass}) bergabung ke room!`
    }, client.ws);
    return;
  }

  // Ensure client is in a valid room for gameplay messages
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;
  const player = room.players.get(client.id);

  // 3. Start Game (Host Only)
  if (type === 'start_game') {
    if (room.hostId !== client.id) return;
    if (room.status === 'playing') return;

    const activePlayers = Array.from(room.players.values()).filter(p => !p.isSpectator);
    if (activePlayers.length < 2) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Minimal butuh 2 pemain (selain spektator) untuk memulai game!'
      }));
      return;
    }

    // Role assignment
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

    broadcastToRoom(room, {
      type: 'game_started',
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values()),
      stations: room.stations,
      gameStartTime: room.gameStartTime
    });
    return;
  }

  // 4. Player Update (Movement)
  if (type === 'player_update' && player) {
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
    }, client.ws);
    return;
  }

  // 5. Shield Usage
  if (type === 'use_shield' && player && player.role === 'crew') {
    const now = (performance.now() - room.gameStartTime) / 1000;
    player.shieldEndTime = now + room.config.shieldDuration;
    player.shieldCooldownUntil = now + Math.max(room.config.shieldCooldown, room.config.shieldDuration);

    broadcastToRoom(room, {
      type: 'shield_used',
      playerId: player.id,
      shieldEndTime: player.shieldEndTime,
      shieldCooldownUntil: player.shieldCooldownUntil
    });
    return;
  }

  // 6. Impostor Shoot
  if (type === 'shoot_bullet' && player && player.role === 'impostor') {
    broadcastToRoom(room, {
      type: 'bullet_fired',
      shooterId: player.id,
      x: player.x,
      y: player.y,
      angle: msg.angle || player.angle || 0
    });
    return;
  }

  // 7. Task Answered
  if (type === 'task_completed' && player) {
    const stationIndex = msg.stationIndex;
    const duration = msg.duration || 3.0;

    player.doneTasks++;
    player.correctAnswers++;
    player.totalAttempts++;
    player.taskDurations.push(duration);
    if (typeof stationIndex === 'number') {
      player.completedBitmask |= (1 << stationIndex);
    }

    broadcastToRoom(room, {
      type: 'task_progress',
      playerId: player.id,
      doneTasks: player.doneTasks,
      correctAnswers: player.correctAnswers,
      totalAttempts: player.totalAttempts,
      completedBitmask: player.completedBitmask,
      message: `${player.name} (${player.playerClass}) berhasil menyelesaikan soal!`
    });

    const victory = checkRoomVictory(room);
    if (victory) {
      broadcastToRoom(room, {
        type: 'game_over',
        summary: victory
      });
    }
    return;
  }

  if (type === 'task_failed' && player) {
    player.wrongAnswers++;
    player.totalAttempts++;
    if (typeof msg.stationIndex === 'number') {
      const now = (performance.now() - room.gameStartTime) / 1000;
      player.lockedStations[msg.stationIndex] = now + 6;
    }

    broadcastToRoom(room, {
      type: 'task_failed',
      playerId: player.id,
      wrongAnswers: player.wrongAnswers,
      totalAttempts: player.totalAttempts
    });
    return;
  }

  // 8. Player Hit
  if (type === 'player_hit' && player && player.role === 'crew') {
    if (player.dead) return;

    player.hp--;
    if (player.hp <= 0) {
      player.dead = true;
      const gameTime = Math.max(1, (performance.now() - room.gameStartTime) / 1000);
      player.eliminatedAt = gameTime;

      broadcastToRoom(room, {
        type: 'player_eliminated',
        playerId: player.id,
        name: player.name,
        playerClass: player.playerClass,
        eliminatedAt: gameTime,
        message: `${player.name} (${player.playerClass}) tertangkap oleh penyusup!`
      });
    } else {
      broadcastToRoom(room, {
        type: 'player_damaged',
        playerId: player.id,
        hp: player.hp,
        message: `${player.name} terkena serangan! (Nyawa: ${player.hp})`
      });
    }

    const victory = checkRoomVictory(room);
    if (victory) {
      broadcastToRoom(room, {
        type: 'game_over',
        summary: victory
      });
    }
    return;
  }

  // 9. Return to Lobby
  if (type === 'return_to_lobby' && room.hostId === client.id) {
    room.status = 'lobby';
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

    broadcastToRoom(room, {
      type: 'returned_to_lobby',
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values())
    });
    return;
  }

  // 10. Chat Message
  if (type === 'chat_message' && player) {
    const text = String(msg.text || '').trim().slice(0, 80);
    if (text) {
      broadcastToRoom(room, {
        type: 'chat_broadcast',
        senderName: player.name,
        senderClass: player.playerClass,
        senderColor: player.color,
        text,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
    }
  }
}

function handleClientDisconnect(client: ConnectedClient) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;

  const leavingPlayer = room.players.get(client.id);
  room.players.delete(client.id);

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  // Reassign host if host left
  if (room.hostId === client.id) {
    const nextPlayer = room.players.values().next().value;
    if (nextPlayer) {
      room.hostId = nextPlayer.id;
      room.hostName = nextPlayer.name;
      nextPlayer.isHost = true;
    }
  }

  broadcastToRoom(room, {
    type: 'player_left',
    playerId: client.id,
    name: leavingPlayer?.name,
    playerClass: leavingPlayer?.playerClass,
    players: Array.from(room.players.values()),
    newHostId: room.hostId,
    message: `${leavingPlayer?.name || 'Pemain'} keluar dari room.`
  });

  if (room.status === 'playing') {
    const victory = checkRoomVictory(room);
    if (victory) {
      broadcastToRoom(room, {
        type: 'game_over',
        summary: victory
      });
    }
  }
}

// Full-Stack Server Mounting (Vite middlewares in dev, static files in prod)
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
    console.log(`🎮 Detektif Kelas Online Server running on port ${PORT}`);
  });
}

startServer();
