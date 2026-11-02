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
  completedBitmask: number;
  lockedStations: Record<number, number>; // station index -> unlock timestamp
  
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
