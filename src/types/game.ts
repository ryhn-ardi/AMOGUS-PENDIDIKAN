export type PlayerRole = 'crew' | 'impostor';

export interface Question {
  q: string;
  o: string[];
  a: number;
  subject?: string;
}

export interface Player {
  id: string;
  name: string;
  playerClass?: string; // Kelas siswa (contoh: "7A", "8-B", "Kelas 9")
  attendanceNumber?: string; // Nomor absen siswa (contoh: "12", "05")
  role: PlayerRole;
  color: string;
  x: number;
  y: number;
  dir: number; // 1 = right, -1 = left
  hp: number;
  maxHp: number;
  dead: boolean;
  isMe: boolean;
  isAI: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
  eliminatedAt: number | null; // game time in seconds when player died
  survivedUntilEnd: boolean;
  
  // Stats for leaderboard
  doneTasks: number;
  totalAttempts: number;
  correctAnswers: number;
  wrongAnswers: number;
  taskDurations: number[]; // time spent on each question answered
  
  // Abilities & state
  shieldEndTime: number;
  shieldCooldownUntil: number;
  invulnerableUntil: number;
  freezeUntil: number;
  workUntil: number;
  angle?: number;
  shootCooldownUntil?: number;
  // Velocity & LERP interpolation
  vx?: number;
  vy?: number;
  remoteTargetX?: number;
  remoteTargetY?: number;
  completedBitmask: number;
  lockedStations: Record<number, number>;
  
  // AI specific
  aiAccuracy?: number;
  targetStation?: any;
  aiPending?: boolean;
}

export interface TaskStation {
  i: number;
  x: number;
  y: number;
  roomIndex: number;
}

export interface GameBullet {
  id?: string;
  shooterId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface GameConfig {
  impostorsCount: number;
  crewLives: number;
  shieldDuration: number;
  shieldCooldown: number;
  impostorShotCooldown: number;
  speedBoostPerTask: number;
  tasksToWin: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  playerClass?: string;
  attendanceNumber?: string;
  role: PlayerRole;
  isMe: boolean;
  color: string;
  scoreTasks: number;       // Soal dijawab benar
  totalAttempts: number;    // Total percobaan
  accuracy: number;         // % akurasi
  survivalTime: number;     // Berapa lama bertahan dalam detik
  survived: boolean;        // Apakah masih tersisa saat game berakhir
  avgSpeed: number;         // Seberapa cepat mengerjakan (rata-rata detik / soal)
  compositeScore: number;   // Nilai total gabungan
  rank?: number;
}

export interface MatchSummary {
  id: string;
  date: string;
  winnerTeam: 'crew' | 'impostor';
  winnerTitle: string;
  reason: string;
  survivingCrewCount: number;
  totalCrewCount: number;
  survivingImpostorCount: number;
  totalImpostorCount: number;
  matchDuration: number;
  leaderboard: LeaderboardEntry[];
}

export interface OnlineRoomData {
  code: string;
  hostId: string;
  hostName: string;
  status: 'lobby' | 'playing' | 'ended';
  config: GameConfig;
  questions: Question[];
  createdAt: number;
}

export interface ClientMessage {
  type: string;
  roomCode?: string;
  name?: string;
  playerClass?: string;
  isSpectator?: boolean;
  config?: GameConfig;
  questions?: Question[];
  payload?: any;
}

export interface ServerMessage {
  type: string;
  room?: OnlineRoomData;
  players?: Player[];
  player?: Player;
  summary?: MatchSummary;
  message?: string;
  bullet?: GameBullet;
  bulletId?: string;
  targetId?: string;
  error?: string;
  stations?: TaskStation[];
  gameTime?: number;
}
