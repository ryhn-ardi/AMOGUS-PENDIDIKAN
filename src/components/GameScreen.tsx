import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Question, TaskStation, GameBullet, GameConfig, MatchSummary, OnlineRoomData } from '../types/game';
import { sounds } from '../utils/sound';
import { calculateLeaderboard, saveMatchResult } from '../utils/leaderboard';
import { Shield, Skull, Eye, Volume2, VolumeX, LogOut, CheckCircle, Zap, DoorOpen, Gamepad2 } from 'lucide-react';
import { api } from '../utils/network';
import { firebaseMultiplayer } from '../utils/firebaseMultiplayer';

interface Props {
  questions: Question[];
  config: GameConfig;
  isSpectator: boolean;
  playerName: string;
  playerClass?: string;
  attendanceNumber?: string;
  ws?: WebSocket | null;
  onlineRoom?: OnlineRoomData | null;
  initialOnlinePlayers?: Player[];
  initialStations?: TaskStation[];
  myPlayerId?: string;
  onGameOver: (summary: MatchSummary) => void;
  onExit: () => void;
}

const RS = 600;
const W = 1800;
const H = 1200;
const S = 1.5;

const ROOMS = ["Perpustakaan", "Laboratorium", "Kantin", "Aula", "Ruang Kelas", "Taman"];
const FLOOR_COLORS = ["#3b3326", "#2a3b45", "#463b27", "#3a2f45", "#2f4440", "#2d4a2a"];

const BASE_WALLS: [number, number, number, number][] = [
  [0, -10, W, 20],
  [0, H - 10, W, 20],
  [-10, 0, 20, H],
  [W - 10, 0, 20, H]
];
[RS, 2 * RS].forEach(x => {
  [[0, 225], [375, 450], [975, 225]].forEach(s => {
    BASE_WALLS.push([x - 10, s[0], 20, s[1]]);
  });
});
[[0, 225], [375, 450], [975, 450], [1575, 225]].forEach(s => {
  BASE_WALLS.push([s[0], RS - 10, s[1], 20]);
});

export interface RoomDoor {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isOpen: boolean;
  openProgress: number; // 0 = closed (solid), 1 = fully open
  orientation: 'horizontal' | 'vertical';
  lastInteractedAt: number;
}

export const INITIAL_ROOM_DOORS: RoomDoor[] = [
  // Pintu 1: Antara Perpustakaan & Laboratorium (x: 600, y: 225 - 375)
  { id: 'door_0_1', name: 'Pintu Lab - Perpus', x: RS - 8, y: 225, w: 16, h: 150, isOpen: false, openProgress: 0, orientation: 'vertical', lastInteractedAt: 0 },
  // Pintu 2: Antara Laboratorium & Kantin (x: 1200, y: 225 - 375)
  { id: 'door_1_2', name: 'Pintu Lab - Kantin', x: 2 * RS - 8, y: 225, w: 16, h: 150, isOpen: false, openProgress: 0, orientation: 'vertical', lastInteractedAt: 0 },
  // Pintu 3: Antara Perpustakaan & Aula (x: 225 - 375, y: 600)
  { id: 'door_0_3', name: 'Pintu Perpus - Aula', x: 225, y: RS - 8, w: 150, h: 16, isOpen: false, openProgress: 0, orientation: 'horizontal', lastInteractedAt: 0 },
  // Pintu 4: Antara Laboratorium & Ruang Kelas (x: 825 - 975, y: 600)
  { id: 'door_1_4', name: 'Pintu Lab - Kelas', x: 825, y: RS - 8, w: 150, h: 16, isOpen: false, openProgress: 0, orientation: 'horizontal', lastInteractedAt: 0 },
  // Pintu 5: Antara Kantin & Taman (x: 1425 - 1575, y: 600)
  { id: 'door_2_5', name: 'Pintu Kantin - Taman', x: 1425, y: RS - 8, w: 150, h: 16, isOpen: false, openProgress: 0, orientation: 'horizontal', lastInteractedAt: 0 },
  // Pintu 6: Antara Aula & Ruang Kelas (x: 600, y: 825 - 975)
  { id: 'door_3_4', name: 'Pintu Aula - Kelas', x: RS - 8, y: 825, w: 16, h: 150, isOpen: false, openProgress: 0, orientation: 'vertical', lastInteractedAt: 0 },
  // Pintu 7: Antara Ruang Kelas & Taman (x: 1200, y: 825 - 975)
  { id: 'door_4_5', name: 'Pintu Kelas - Taman', x: 2 * RS - 8, y: 825, w: 16, h: 150, isOpen: false, openProgress: 0, orientation: 'vertical', lastInteractedAt: 0 }
];

// Padat & Solid: Meja, Rak Buku, Meja Lab, Counter Kantin, Panggung Aula, Meja Kelas, Pohon & Kolam Taman
export interface SolidObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
}

export const SOLID_OBSTACLES: SolidObstacle[] = [
  // Room 0: Perpustakaan (0 - 600, 0 - 600) -> Labirin Rak Buku Perpustakaan
  { x: 50, y: 55, w: 200, h: 42, name: 'Rak Buku Utara 1' },
  { x: 350, y: 55, w: 200, h: 42, name: 'Rak Buku Utara 2' },
  { x: 130, y: 160, w: 42, h: 220, name: 'Rak Ensiklopedia Barat' },
  { x: 428, y: 160, w: 42, h: 220, name: 'Rak Ensiklopedia Timur' },
  { x: 235, y: 240, w: 130, h: 65, name: 'Meja Belajar Utama' },
  { x: 235, y: 390, w: 130, h: 45, name: 'Sofa Baca Perpustakaan' },

  // Room 1: Laboratorium (600 - 1200, 0 - 600) -> Labirin Meja Reagen & Mikroskop
  { x: 660, y: 55, w: 210, h: 44, name: 'Meja Reagen Lab Utara 1' },
  { x: 930, y: 55, w: 210, h: 44, name: 'Meja Reagen Lab Utara 2' },
  { x: 730, y: 175, w: 125, h: 65, name: 'Meja Praktikum Barat' },
  { x: 945, y: 175, w: 125, h: 65, name: 'Meja Praktikum Timur' },
  { x: 670, y: 430, w: 140, h: 50, name: 'Lemari Asam Lab' },
  { x: 990, y: 430, w: 140, h: 50, name: 'Meja Centrifuge & Alat' },

  // Room 2: Kantin (1200 - 1800, 0 - 600) -> Labirin Prasmanan & Meja Makan
  { x: 1260, y: 55, w: 480, h: 44, name: 'Counter Prasmanan Kantin' },
  { x: 1310, y: 180, w: 90, h: 70, name: 'Meja Makan Kantin 1' },
  { x: 1590, y: 180, w: 90, h: 70, name: 'Meja Makan Kantin 2' },
  { x: 1690, y: 310, w: 48, h: 180, name: 'Kedai Minuman Kantin' },
  { x: 1310, y: 380, w: 90, h: 70, name: 'Meja Makan Kantin 3' },

  // Room 3: Aula (0 - 600, 600 - 1200) -> Labirin Baris Kursi Aula & Panggung
  { x: 60, y: 1100, w: 480, h: 60, name: 'Panggung Utama Aula' },
  // Baris Kursi 1 (celah tengah di x: 230 - 370)
  { x: 60, y: 690, w: 170, h: 30, name: 'Bangku Aula Baris 1 Kiri' },
  { x: 370, y: 690, w: 170, h: 30, name: 'Bangku Aula Baris 1 Kanan' },
  // Baris Kursi 2 (celah samping kiri & kanan)
  { x: 150, y: 770, w: 300, h: 30, name: 'Bangku Aula Baris 2 Tengah' },
  // Baris Kursi 3 (celah tengah)
  { x: 60, y: 850, w: 170, h: 30, name: 'Bangku Aula Baris 3 Kiri' },
  { x: 370, y: 850, w: 170, h: 30, name: 'Bangku Aula Baris 3 Kanan' },
  // Baris Kursi 4 (celah samping kiri & kanan)
  { x: 150, y: 930, w: 300, h: 30, name: 'Bangku Aula Baris 4 Tengah' },
  { x: 60, y: 1020, w: 85, h: 40, name: 'Meja Operator Audio' },

  // Room 4: Ruang Kelas (600 - 1200, 600 - 1200) -> Labirin Meja Belajar Siswa
  { x: 800, y: 665, w: 200, h: 40, name: 'Whiteboard & Meja Guru' },
  { x: 670, y: 745, w: 90, h: 50, name: 'Meja Siswa Kelompok 1' },
  { x: 1040, y: 745, w: 90, h: 50, name: 'Meja Siswa Kelompok 2' },
  { x: 740, y: 865, w: 110, h: 50, name: 'Meja Siswa Kelompok 3' },
  { x: 950, y: 865, w: 110, h: 50, name: 'Meja Siswa Kelompok 4' },
  { x: 670, y: 990, w: 90, h: 50, name: 'Meja Siswa Kelompok 5' },
  { x: 1040, y: 990, w: 90, h: 50, name: 'Meja Siswa Kelompok 6' },
  { x: 860, y: 1120, w: 80, h: 36, name: 'Lemari Arsip Kelas' },

  // Room 5: Taman (1200 - 1800, 600 - 1200) -> Labirin Pagar Semak & Kolam Ikan
  { x: 1290, y: 690, w: 180, h: 34, name: 'Pagar Semak Hijau 1' },
  { x: 1560, y: 690, w: 170, h: 34, name: 'Pagar Semak Hijau 2' },
  { x: 1450, y: 810, w: 130, h: 80, name: 'Kolam Ikan Koi' },
  { x: 1450, y: 970, w: 180, h: 34, name: 'Pagar Semak Bunga' },
  { x: 1290, y: 960, w: 90, h: 65, name: 'Gazebo Santai Taman' },
  { x: 1270, y: 1110, w: 55, h: 55, name: 'Pohon Rindang Barat' },
  { x: 1715, y: 1110, w: 55, h: 55, name: 'Pohon Rindang Timur' },
  { x: 1715, y: 770, w: 55, h: 55, name: 'Pohon Cemara Taman' }
];

// Semua rintangan dinding + perabotan padat
export const ALL_OBSTACLES: [number, number, number, number][] = [
  ...BASE_WALLS,
  ...SOLID_OBSTACLES.map(o => [o.x, o.y, o.w, o.h] as [number, number, number, number])
];

// Pemeriksaan tabrakan umum terhadap rintangan padat
export function checkCollisionAt(x: number, y: number, r: number = 18): boolean {
  for (const w of ALL_OBSTACLES) {
    const cx = Math.max(w[0], Math.min(x, w[0] + w[2]));
    const cy = Math.max(w[1], Math.min(y, w[1] + w[3]));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}

// Penentu Posisi Spawn Bebas Macet (Pencegah Karakter Terjebak Objek Padat)
export function getSafeSpawn(
  preferredX: number,
  preferredY: number,
  radius: number = 20
): [number, number] {
  if (!checkCollisionAt(preferredX, preferredY, radius)) {
    return [preferredX, preferredY];
  }

  // Spiral ke luar mencari ruang bebas terdekat
  for (let dist = 15; dist <= 350; dist += 15) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const tx = Math.round(preferredX + Math.cos(angle) * dist);
      const ty = Math.round(preferredY + Math.sin(angle) * dist);
      if (tx < 50 || tx > W - 50 || ty < 50 || ty > H - 50) continue;
      if (!checkCollisionAt(tx, ty, radius)) {
        return [tx, ty];
      }
    }
  }

  // Koordinat fallback aman di lorong terbuka kelas
  return [880, 750];
}

// Calon Lokasi Stasiun Soal Acak per Ruangan (bebas dari rintangan padat)
export const CANDIDATE_ROOM_STATIONS: Record<number, [number, number][]> = {
  // Room 0: Perpustakaan (0 - 600, 0 - 600)
  0: [[75, 270], [290, 150], [520, 270], [290, 490], [80, 480], [510, 480]],
  // Room 1: Laboratorium (600 - 1200, 0 - 600)
  1: [[690, 310], [900, 310], [1110, 310], [900, 490], [890, 130], [1110, 130]],
  // Room 2: Kantin (1200 - 1800, 0 - 600)
  2: [[1480, 180], [1480, 340], [1355, 290], [1595, 340], [1480, 490], [1650, 490]],
  // Room 3: Aula (0 - 600, 600 - 1200)
  3: [[300, 640], [300, 810], [300, 990], [100, 770], [500, 770], [100, 930]],
  // Room 4: Ruang Kelas (600 - 1200, 600 - 1200)
  4: [[900, 750], [900, 960], [790, 810], [1010, 810], [750, 1070], [1050, 1070]],
  // Room 5: Taman (1200 - 1800, 600 - 1200)
  5: [[1380, 760], [1630, 760], [1370, 890], [1630, 890], [1400, 1070], [1600, 1070]]
};

// Fungsi pengacak stasiun soal merata di tiap ruangan
export function generateRandomizedStations(count: number = 8): TaskStation[] {
  const stations: TaskStation[] = [];
  const rooms = [0, 1, 2, 3, 4, 5];
  const shuffledRooms = [...rooms].sort(() => Math.random() - 0.5);

  let stationIndex = 0;
  for (let i = 0; i < count; i++) {
    const roomIdx = shuffledRooms[i % shuffledRooms.length];
    const candidates = CANDIDATE_ROOM_STATIONS[roomIdx];
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const jitterX = Math.round((Math.random() - 0.5) * 20);
    const jitterY = Math.round((Math.random() - 0.5) * 20);

    stations.push({
      i: stationIndex++,
      x: chosen[0] + jitterX,
      y: chosen[1] + jitterY,
      roomIndex: roomIdx
    });
  }

  return stations;
}

// Spawn Point Kru Detektif (Pasti Bersih & Jauh dari Perabotan / Meja / Dinding)
const CP: [number, number][] = [
  [880, 750], [920, 750], [880, 960], [920, 960],
  [860, 810], [940, 810], [300, 640], [300, 990]
];
// Spawn Point Penyusup (Pasti Bersih di 4 Sudut Bebas Rintangan)
const IP: [number, number][] = [
  [80, 140], [1720, 140], [80, 640], [1720, 640]
];

const BOT_CREW_NAMES = ["Rani", "Budi", "Sari", "Dimas", "Alya", "Reza", "Putri", "Gilang"];
const BOT_CLASSES = ["7A", "7B", "8A", "8B", "9A", "9C"];
const BOT_IMP_NAMES = ["Bayangan", "Penyusup Hitam", "Hantu Sekolah", "Mr. X"];
const CREW_COLORS = ["#4aa3df", "#e8a33d", "#b57edc", "#5cc98a", "#4dd0c4", "#f08ca8", "#8fb4ff", "#c5e063"];

interface JoystickControlProps {
  onMove: (vector: { x: number; y: number }) => void;
}

const JoystickControl: React.FC<JoystickControlProps> = ({ onMove }) => {
  const [touchPos, setTouchPos] = useState<{
    active: boolean;
    currX: number;
    currY: number;
  }>({ active: false, currX: 72, currY: 72 });

  const containerRef = useRef<HTMLDivElement | null>(null);

  const processTouch = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const touchX = clientX - rect.left;
    const touchY = clientY - rect.top;

    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxR = 48;

    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const normX = clampedDist > 2 ? Math.cos(angle) * (clampedDist / maxR) : 0;
    const normY = clampedDist > 2 ? Math.sin(angle) * (clampedDist / maxR) : 0;

    setTouchPos({
      active: clampedDist > 2,
      currX: centerX + Math.cos(angle) * clampedDist,
      currY: centerY + Math.sin(angle) * clampedDist
    });

    onMove({ x: normX, y: normY });
  }, [onMove]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      processTouch(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      processTouch(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    setTouchPos({ active: false, currX: 72, currY: 72 });
    onMove({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => { e.preventDefault(); processTouch(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (e.buttons > 0) { e.preventDefault(); processTouch(e.clientX, e.clientY); } }}
      onPointerUp={(e) => { e.preventDefault(); setTouchPos({ active: false, currX: 72, currY: 72 }); onMove({ x: 0, y: 0 }); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative w-36 h-36 rounded-full bg-[#14261f]/90 border-2 border-[#f5d547]/60 shadow-2xl touch-none select-none flex items-center justify-center backdrop-blur-xs cursor-pointer"
    >
      {/* Outer Mobile Legends Ring Grid */}
      <div className="absolute inset-1.5 rounded-full border border-[#f5d547]/40 pointer-events-none flex items-center justify-center">
        <div className="w-full h-0.5 bg-[#f5d547]/25 absolute" />
        <div className="h-full w-0.5 bg-[#f5d547]/25 absolute" />
      </div>

      {/* Inner Stick Knob */}
      {touchPos.active ? (
        <div
          className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-[#f5d547] to-[#e8a33d] border-2 border-white shadow-xl pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[#14261f] font-bold text-xs"
          style={{
            left: `${touchPos.currX}px`,
            top: `${touchPos.currY}px`
          }}
        >
          🎮
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#1d3a2f] border-2 border-[#f5d547] shadow-md pointer-events-none flex items-center justify-center text-[#f5d547] text-xs font-bold">
          🕹️
        </div>
      )}
    </div>
  );
};

export const GameScreen: React.FC<Props> = ({
  questions,
  config,
  isSpectator,
  playerName,
  playerClass = 'Umum',
  attendanceNumber = '',
  ws = null,
  onlineRoom = null,
  initialOnlinePlayers,
  initialStations,
  myPlayerId,
  onGameOver,
  onExit
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // HUD state
  const [hudLives, setHudLives] = useState<number>(config.crewLives);
  const [hudRoom, setHudRoom] = useState<string>("Aula");
  const [hudSpeed, setHudSpeed] = useState<string>("x1.00");
  const [shieldCooldownLeft, setShieldCooldownLeft] = useState<number>(0);
  const [isShieldActive, setIsShieldActive] = useState<boolean>(false);
  const [canInteractTask, setCanInteractTask] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<string>("");
  const [soundOn, setSoundOn] = useState<boolean>(sounds.isSoundEnabled());
  const [controlMode, setControlMode] = useState<'joystick' | 'dpad'>('joystick');

  // Task / Quiz state
  const [activeQuiz, setActiveQuiz] = useState<{
    stationIndex: number;
    question: Question;
    shuffledOptions: { text: string; origIdx: number }[];
    answered: boolean;
    selectedIdx: number | null;
  } | null>(null);

  // Spectator target view
  const [spectatorTargetId, setSpectatorTargetId] = useState<string | null>(null);

  // Surviving counts
  const [survivingCrew, setSurvivingCrew] = useState<number>(4);
  const [survivingImps, setSurvivingImps] = useState<number>(config.impostorsCount);
  const [totalCrew, setTotalCrew] = useState<number>(4);

  // Linear Interpolation (LERP) helper
  const lerp = (start: number, end: number, factor: number): number => {
    return start + (end - start) * Math.min(1, Math.max(0, factor));
  };

  // Door interaction state
  const [nearDoor, setNearDoor] = useState<RoomDoor | null>(null);

  // Mutable Game Loop State
  const gameRef = useRef<{
    t: number;
    over: boolean;
    bullets: GameBullet[];
    stations: TaskStation[];
    players: Player[];
    myPlayer: Player | null;
    keys: Record<string, boolean>;
    joystickVector: { x: number; y: number };
    inputBuffer: {
      keys: Record<string, boolean>;
      joystick: { x: number; y: number };
    };
    deck: number[];
    quizStartTime: number;
    activeStationIndex: number | null;
    lastNetSyncTime: number;
    doors: RoomDoor[];
  }>({
    t: 0,
    over: false,
    bullets: [],
    stations: [],
    players: [],
    myPlayer: null,
    keys: {},
    joystickVector: { x: 0, y: 0 },
    inputBuffer: {
      keys: { up: false, down: false, left: false, right: false },
      joystick: { x: 0, y: 0 }
    },
    deck: [],
    quizStartTime: 0,
    activeStationIndex: null,
    lastNetSyncTime: 0,
    doors: INITIAL_ROOM_DOORS.map(d => ({ ...d }))
  });

  const bannerTimeoutRef = useRef<any>(null);
  const showBanner = useCallback((text: string) => {
    setBannerMsg(text);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setBannerMsg(""), 3000);
  }, []);

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const getNextQuestion = useCallback((): Question => {
    const g = gameRef.current;
    if (g.deck.length === 0) {
      g.deck = shuffle(questions.map((_, i) => i));
    }
    const idx = g.deck.pop() ?? 0;
    return questions[idx % questions.length] || questions[0];
  }, [questions]);

  const isWallHit = (x: number, y: number, r: number) => {
    // 1. Static obstacles (walls, tables, lab gear, bookcases)
    for (const w of ALL_OBSTACLES) {
      const cx = Math.max(w[0], Math.min(x, w[0] + w[2]));
      const cy = Math.max(w[1], Math.min(y, w[1] + w[3]));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }

    // 2. Dynamic Sliding Doors (Exact physical panel collision synchronized with visual animation)
    const doors = gameRef.current.doors;
    if (doors) {
      for (const d of doors) {
        const isHoriz = d.orientation === 'horizontal';
        const slideOffset = (isHoriz ? d.w / 2 : d.h / 2) * d.openProgress;

        if (isHoriz) {
          const halfW = d.w / 2;
          // Left panel solid box
          const p1x = Math.max(d.x - slideOffset, Math.min(x, d.x - slideOffset + halfW));
          const p1y = Math.max(d.y, Math.min(y, d.y + d.h));
          if ((x - p1x) ** 2 + (y - p1y) ** 2 < r * r) return true;

          // Right panel solid box
          const p2x = Math.max(d.x + halfW + slideOffset, Math.min(x, d.x + halfW + slideOffset + halfW));
          const p2y = Math.max(d.y, Math.min(y, d.y + d.h));
          if ((x - p2x) ** 2 + (y - p2y) ** 2 < r * r) return true;
        } else {
          const halfH = d.h / 2;
          // Top panel solid box
          const p1x = Math.max(d.x, Math.min(x, d.x + d.w));
          const p1y = Math.max(d.y - slideOffset, Math.min(y, d.y - slideOffset + halfH));
          if ((x - p1x) ** 2 + (y - p1y) ** 2 < r * r) return true;

          // Bottom panel solid box
          const p2x = Math.max(d.x, Math.min(x, d.x + d.w));
          const p2y = Math.max(d.y + halfH + slideOffset, Math.min(y, d.y + halfH + slideOffset + halfH));
          if ((x - p2x) ** 2 + (y - p2y) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  };

  const toggleDoor = useCallback((doorId: string) => {
    const g = gameRef.current;
    const door = g.doors.find(d => d.id === doorId);
    if (!door) return;

    door.isOpen = !door.isOpen;
    (door as any).closeTimer = g.t + 5.0; // Pintu otomatis menutup kembali setelah 5 detik
    door.lastInteractedAt = g.t;
    sounds.playDoor(door.isOpen);
    showBanner(door.isOpen ? `${door.name} Terbuka!` : `${door.name} Ditutup!`);

    if (onlineRoom) {
      const payload = { doorId, isOpen: door.isOpen };
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'toggle_door', ...payload }));
      }
      api.sendAction(onlineRoom.code, 'toggle_door', payload).catch(() => {});
      firebaseMultiplayer.sendEvent(onlineRoom.code, 'toggle_door', payload).catch(() => {});
    }
  }, [onlineRoom, ws, showBanner]);

  // Mobile Legends / Roblox style friction-free Wall Sliding Physics
  const moveEntity = (p: Player, moveVx: number, moveVy: number, r = 13) => {
    if (moveVx === 0 && moveVy === 0) return;

    // Step 1: Direct unobstructed diagonal movement
    if (!isWallHit(p.x + moveVx, p.y + moveVy, r)) {
      p.x += moveVx;
      p.y += moveVy;
      return;
    }

    // Step 2: Slide along X axis
    const canMoveX = !isWallHit(p.x + moveVx, p.y, r);
    if (canMoveX) p.x += moveVx;

    // Step 3: Slide along Y axis
    const canMoveY = !isWallHit(p.x, p.y + moveVy, r);
    if (canMoveY) p.y += moveVy;

    // Step 4: Corner anti-stuck sub-stepping (smooth gliding around obstacle corners)
    if (!canMoveX && !canMoveY) {
      const steps = [0.7, 0.4];
      for (const step of steps) {
        if (!isWallHit(p.x + moveVx * step, p.y + moveVy * step, r)) {
          p.x += moveVx * step;
          p.y += moveVy * step;
          break;
        }
        if (!isWallHit(p.x + moveVx * step, p.y, r)) {
          p.x += moveVx * step;
          break;
        }
        if (!isWallHit(p.x, p.y + moveVy * step, r)) {
          p.y += moveVy * step;
          break;
        }
      }
    }
  };

  const getRoomAt = (x: number, y: number) => {
    return Math.min(2, Math.floor(x / RS)) + (y >= RS ? 3 : 0);
  };

  const getSpeed = (p: Player) => {
    return 200 * Math.min(2.0, 1 + (config.speedBoostPerTask / 100) * p.doneTasks);
  };

  const isSafe = (p: Player, t: number) => {
    return p.workUntil > t || p.invulnerableUntil > t || p.shieldEndTime > t;
  };

  const findNearStation = (p: Player, t: number): TaskStation | null => {
    let closest: TaskStation | null = null;
    let minDist = 65;
    for (const s of gameRef.current.stations) {
      if ((p.completedBitmask >> s.i) & 1) continue;
      if ((p.lockedStations[s.i] || 0) > t) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < minDist) {
        minDist = d;
        closest = s;
      }
    }
    return closest;
  };

  // Skill Trigger
  const triggerSkill = useCallback((p: Player) => {
    const g = gameRef.current;
    if (!p || p.dead || g.over || p.workUntil > g.t) return;

    if (p.role === 'impostor') {
      if (g.t < (p.shootCooldownUntil || 0)) return;
      sounds.playShoot();
      p.shootCooldownUntil = g.t + config.impostorShotCooldown;

      let target: { x: number; y: number } | null = null;
      let minDist = 520;
      for (const other of g.players) {
        if (other.role === 'crew' && !other.dead) {
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < minDist) {
            minDist = d;
            target = { x: other.x, y: other.y };
          }
        }
      }
      const angle = target
        ? Math.atan2(target.y - p.y, target.x - p.x)
        : (p.angle || 0);

      // Spawn bullets locally
      [-0.32, 0, 0.32].forEach(offset => {
        g.bullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle + offset) * 350,
          vy: Math.sin(angle + offset) * 350,
          life: 1.2
        });
      });

      // Broadcast to other players
      if (onlineRoom && p.isMe) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'shoot_bullet', angle }));
        }
        api.sendAction(onlineRoom.code, 'shoot_bullet', { angle }).catch(() => {});
      }
    } else {
      // Crew Shield
      if (g.t < p.shieldCooldownUntil) return;
      sounds.playShield();
      p.shieldEndTime = g.t + config.shieldDuration;
      p.shieldCooldownUntil = g.t + Math.max(config.shieldCooldown, config.shieldDuration);

      if (p.isMe) {
        showBanner("Tameng aktif! Kebal dari serangan selama " + config.shieldDuration + " detik.");
      }

      if (onlineRoom && p.isMe) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'use_shield' }));
        }
        api.sendAction(onlineRoom.code, 'use_shield', {}).catch(() => {});
      }
    }
  }, [config, showBanner, ws, onlineRoom]);

  // Open Quiz
  const interactTask = useCallback(() => {
    const g = gameRef.current;
    if (g.over) return;
    const me = g.myPlayer;
    if (!me || me.dead || me.workUntil > g.t) return;

    const s = findNearStation(me, g.t);
    if (!s) return;

    const q = getNextQuestion();
    const shuffled = shuffle(q.o.map((text, origIdx) => ({ text, origIdx })));

    me.workUntil = Infinity;
    g.quizStartTime = performance.now();
    g.activeStationIndex = s.i;

    // Notify online server that player started task
    if (onlineRoom) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'player_update',
          workUntil: me.workUntil
        }));
      }
      api.sendAction(onlineRoom.code, 'player_update', { workUntil: me.workUntil }).catch(() => {});
    }

    setActiveQuiz({
      stationIndex: s.i,
      question: q,
      shuffledOptions: shuffled,
      answered: false,
      selectedIdx: null
    });
  }, [getNextQuestion, ws, onlineRoom]);

  // Check Team Victory condition (Solo Mode)
  const checkGameEndCondition = useCallback(() => {
    const g = gameRef.current;
    if (g.over) return;

    // If online, server is the source of truth for match victory
    if (onlineRoom && ws) return;

    const survivingCrewPlayers = g.players.filter(p => p.role === 'crew' && !p.dead);
    const survivingImpPlayers = g.players.filter(p => p.role === 'impostor' && !p.dead);
    const totalCrewPlayers = g.players.filter(p => p.role === 'crew');
    const totalImpPlayers = g.players.filter(p => p.role === 'impostor');

    setSurvivingCrew(survivingCrewPlayers.length);
    setSurvivingImps(survivingImpPlayers.length);

    let winnerTeam: 'crew' | 'impostor' | null = null;
    let winnerTitle = '';
    let reason = '';

    // Kondisi 1: SEMUA PENYUSUP GUGUR -> Tim Kru Menang!
    if (survivingImpPlayers.length === 0 && totalImpPlayers.length > 0) {
      winnerTeam = 'crew';
      winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
      reason = `Semua penyusup tertangkap! Kru yang tersisa (${survivingCrewPlayers.length}/${totalCrewPlayers.length} orang) berhasil mempertahankan sekolah hingga titik akhir.`;
    }
    // Kondisi 2: SEMUA SISWA (SURVIVOR) YANG TERSISA SUDAH MENJAWAB SEMUA SOAL -> Tim Kru Menang!
    else if (survivingCrewPlayers.length > 0 && survivingCrewPlayers.every(c => c.doneTasks >= config.tasksToWin)) {
      winnerTeam = 'crew';
      winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
      reason = `Seluruh siswa detektif yang bertahan (${survivingCrewPlayers.length} siswa) berhasil menyelesaikan ${config.tasksToWin} soal kuis! Alarm keamanan sekolah berhasil diaktifkan.`;
    }
    // Kondisi 3: PENYUSUP MENANG JIKA MEMBUNUH SEMUA SURVIVOR DAN MENGERJAKAN SEMUA SOAL!
    else if (survivingCrewPlayers.length === 0 && totalCrewPlayers.length > 0) {
      const impCompletedAllTasks = totalImpPlayers.some(imp => imp.doneTasks >= config.tasksToWin) ||
        totalImpPlayers.reduce((acc, imp) => acc + imp.doneTasks, 0) >= config.tasksToWin;

      if (impCompletedAllTasks) {
        winnerTeam = 'impostor';
        winnerTitle = '🚨 TIM PENYUSUP MENANG!';
        reason = `Penyusup berhasil mengeliminasi semua siswa detektif DAN telah menyelesaikan seluruh soal tugas sekolah (${config.tasksToWin} soal)! Penyusup menang mutlak.`;
      } else {
        // Kru sudah habis, tetapi penyusup belum menyelesaikan semua soal
        if (g.myPlayer?.role === 'impostor') {
          showBanner(`Semua siswa telah tertangkap! Selesaikan ${config.tasksToWin - (g.myPlayer.doneTasks || 0)} soal lagi di stasiun untuk memenangkan permainan!`);
        }
      }
    }

    if (winnerTeam) {
      g.over = true;
      if (winnerTeam === 'crew') {
        sounds.playVictory();
      } else {
        sounds.playDefeat();
      }

      const matchDuration = Math.round(g.t);
      const leaderboard = calculateLeaderboard(g.players, matchDuration);

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
        survivingCrewCount: survivingCrewPlayers.length,
        totalCrewCount: totalCrewPlayers.length,
        survivingImpostorCount: survivingImpPlayers.length,
        totalImpostorCount: totalImpPlayers.length,
        matchDuration,
        leaderboard
      };

      saveMatchResult(summary);
      onGameOver(summary);
    }
  }, [config.tasksToWin, onGameOver, onlineRoom, ws]);

  // Answer Quiz Option
  const handleAnswerOption = (selectedItemIdx: number) => {
    if (!activeQuiz || activeQuiz.answered) return;
    const g = gameRef.current;
    const me = g.myPlayer;
    if (!me) return;

    const answerDuration = Number(((performance.now() - g.quizStartTime) / 1000).toFixed(1));
    me.taskDurations.push(answerDuration);
    me.totalAttempts++;

    const isCorrect = activeQuiz.shuffledOptions[selectedItemIdx].origIdx === activeQuiz.question.a;

    setActiveQuiz(prev => prev ? {
      ...prev,
      answered: true,
      selectedIdx: selectedItemIdx
    } : null);

    if (isCorrect) {
      sounds.playCorrect();
      me.correctAnswers++;
      me.doneTasks++;
      me.completedBitmask |= (1 << activeQuiz.stationIndex);
      showBanner(`Benar! (${answerDuration} dtk). Kecepatan naik ke ${(getSpeed(me)/200).toFixed(2)}x!`);

      if (onlineRoom) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'task_completed',
            stationIndex: activeQuiz.stationIndex,
            duration: answerDuration
          }));
        }
        api.sendAction(onlineRoom.code, 'task_completed', {
          stationIndex: activeQuiz.stationIndex,
          duration: answerDuration
        }).catch(() => {});
      }
    } else {
      sounds.playWrong();
      me.wrongAnswers++;
      me.lockedStations[activeQuiz.stationIndex] = g.t + 6;
      showBanner(`Kurang tepat! Stasiun terkunci selama 6 detik.`);

      if (onlineRoom) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'task_failed',
            stationIndex: activeQuiz.stationIndex
          }));
        }
        api.sendAction(onlineRoom.code, 'task_failed', {
          stationIndex: activeQuiz.stationIndex
        }).catch(() => {});
      }
    }

    setTimeout(() => {
      setActiveQuiz(null);
      if (me) {
        me.workUntil = 0;
        me.invulnerableUntil = g.t + 1.5;
        if (onlineRoom) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'player_update',
              workUntil: 0
            }));
          }
          api.sendAction(onlineRoom.code, 'player_update', { workUntil: 0 }).catch(() => {});
        }
      }
      g.activeStationIndex = null;
      checkGameEndCondition();
    }, isCorrect ? 700 : 1300);
  };

  // Damage Crew
  const damageCrew = useCallback((target: Player, attacker: Player | null) => {
    const g = gameRef.current;
    if (target.dead || isSafe(target, g.t)) return;

    target.hp--;
    target.invulnerableUntil = g.t + 2.5;

    if (attacker) {
      attacker.freezeUntil = g.t + 1.2;
    }

    if (target.hp <= 0) {
      target.dead = true;
      target.eliminatedAt = g.t;
      sounds.playHit();
      if (target.isMe) {
        showBanner("Kamu tertangkap oleh penyusup!");
      } else {
        showBanner(`${target.name} [${target.playerClass || '-'}] gugur disergap penyusup!`);
      }
    } else {
      sounds.playHit();
      if (target.isMe) {
        showBanner(`Terkena serangan! Nyawa tersisa ${target.hp}`);
      }
    }

    if (onlineRoom && target.isMe) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'player_hit'
        }));
      }
      api.sendAction(onlineRoom.code, 'player_hit', {}).catch(() => {});
    }

    checkGameEndCondition();
  }, [checkGameEndCondition, showBanner, ws, onlineRoom]);

  // Main Effect: Init Game and NetSync
  useEffect(() => {
    const g = gameRef.current;
    g.t = 0;
    g.over = false;
    g.bullets = [];
    g.deck = [];
    g.keys = {};
    g.inputBuffer = {
      keys: { up: false, down: false, left: false, right: false },
      joystick: { x: 0, y: 0 }
    };
    g.doors = INITIAL_ROOM_DOORS.map(d => ({ ...d }));
    g.joystickVector = { x: 0, y: 0 };

    // Online Mode setup
    if (onlineRoom && initialOnlinePlayers && initialOnlinePlayers.length > 0) {
      g.stations = (initialStations && initialStations.length > 0)
        ? initialStations
        : generateRandomizedStations(Math.max(config.tasksToWin, 8));

      g.players = initialOnlinePlayers.map(p => {
        const isMe = p.id === myPlayerId || p.isMe;
        const [safeX, safeY] = getSafeSpawn(p.x, p.y);
        return {
          ...p,
          x: safeX,
          y: safeY,
          isMe,
          isAI: false
        };
      });

      g.myPlayer = g.players.find(p => p.isMe) || null;
      const crewCount = g.players.filter(p => p.role === 'crew').length;
      const impCount = g.players.filter(p => p.role === 'impostor').length;
      setTotalCrew(crewCount);
      setSurvivingCrew(crewCount);
      setSurvivingImps(impCount);

      showBanner(
        g.myPlayer?.isSpectator
          ? "Mode Spektator Aktif: Memantau jalannya pertandingan kelas!"
          : g.myPlayer?.role === 'impostor'
          ? "Kamu adalah PENYUSUP! Tangkap kru dan gagalkan tugas mereka."
          : `Kamu adalah KRU (${playerClass})! Kerjakan soal di stasiun dan bertahan dari penyusup.`
      );
    } 
    // Solo / Practice Mode setup with AI Bots
    else {
      const stationCount = isSpectator ? 10 : Math.max(config.tasksToWin, 6);
      g.stations = generateRandomizedStations(stationCount);

      const crewCount = isSpectator ? 6 : 4;
      setTotalCrew(crewCount);
      setSurvivingCrew(crewCount);
      setSurvivingImps(config.impostorsCount);

      const crew: Player[] = Array.from({ length: crewCount }, (_, i) => {
        const isMe = !isSpectator && i === 0;
        const [spawnX, spawnY] = getSafeSpawn(CP[i % CP.length][0], CP[i % CP.length][1]);
        return {
          id: `crew-${i}`,
          name: isMe ? (playerName || 'Kamu') : BOT_CREW_NAMES[i % BOT_CREW_NAMES.length],
          playerClass: isMe ? playerClass : BOT_CLASSES[i % BOT_CLASSES.length],
          attendanceNumber: isMe ? (attendanceNumber || '01') : String(i + 1).padStart(2, '0'),
          role: 'crew',
          color: CREW_COLORS[i % CREW_COLORS.length],
          x: spawnX,
          y: spawnY,
          dir: 1,
          hp: config.crewLives,
          maxHp: config.crewLives,
          dead: false,
          isMe,
          isAI: !isMe,
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
          lockedStations: {},
          aiAccuracy: 0.65 + Math.random() * 0.25
        };
      });

      const imps: Player[] = Array.from({ length: config.impostorsCount }, (_, i) => {
        const [spawnX, spawnY] = getSafeSpawn(IP[i % IP.length][0], IP[i % IP.length][1]);
        return {
          id: `imp-${i}`,
          name: BOT_IMP_NAMES[i % BOT_IMP_NAMES.length],
          playerClass: 'Penyusup',
          role: 'impostor',
          color: '#e0463c',
          x: spawnX,
          y: spawnY,
          dir: 1,
          angle: Math.random() * Math.PI * 2,
          hp: 1,
          maxHp: 1,
          dead: false,
          isMe: false,
          isAI: true,
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
          shootCooldownUntil: 2.0,
          completedBitmask: 0,
          lockedStations: {}
        };
      });

      g.players = [...crew, ...imps];
      g.myPlayer = isSpectator ? null : crew[0];

      showBanner(
        isSpectator 
          ? "Mode Spektator Latihan Aktif: Pantau persaingan Kru dan Penyusup!" 
          : "Temukan stasiun kuning di kelas, kerjakan soal (E/Spasi), dan gunakan tameng (Q)!"
      );
    }

    const lastEventIdRef = { current: 0 };

    const processGameEvent = (type: string, payload: any) => {
      if (type === 'player_moved' || type === 'player_update') {
        const p = g.players.find(x => x.id === payload.playerId);
        if (p && !p.isMe) {
          if (typeof payload.x === 'number') (p as any).targetX = payload.x;
          if (typeof payload.y === 'number') (p as any).targetY = payload.y;
          if (typeof payload.dir === 'number') p.dir = payload.dir;
          if (typeof payload.angle === 'number') p.angle = payload.angle;
          if (typeof payload.workUntil === 'number') p.workUntil = payload.workUntil;
          if (typeof payload.shieldEndTime === 'number') p.shieldEndTime = payload.shieldEndTime;
        }
      } else if (type === 'bullet_fired') {
        const shooter = g.players.find(x => x.id === payload.shooterId);
        if (shooter && !shooter.isMe) {
          sounds.playShoot();
          [-0.32, 0, 0.32].forEach(offset => {
            g.bullets.push({
              x: payload.x,
              y: payload.y,
              vx: Math.cos(payload.angle + offset) * 350,
              vy: Math.sin(payload.angle + offset) * 350,
              life: 1.2
            });
          });
        }
      } else if (type === 'shield_used') {
        const p = g.players.find(x => x.id === payload.playerId);
        if (p && !p.isMe) {
          sounds.playShield();
          p.shieldEndTime = payload.shieldEndTime;
          p.shieldCooldownUntil = payload.shieldCooldownUntil;
        }
      } else if (type === 'task_progress') {
        const p = g.players.find(x => x.id === payload.playerId);
        if (p && !p.isMe) {
          p.doneTasks = payload.doneTasks;
          p.correctAnswers = payload.correctAnswers;
          p.totalAttempts = payload.totalAttempts;
          p.completedBitmask = payload.completedBitmask;
        }
        if (payload.message) showBanner(payload.message);
      } else if (type === 'player_damaged') {
        const p = g.players.find(x => x.id === payload.playerId);
        if (p) {
          p.hp = payload.hp;
          sounds.playHit();
        }
        if (payload.message) showBanner(payload.message);
      } else if (type === 'player_eliminated') {
        const p = g.players.find(x => x.id === payload.playerId);
        if (p) {
          p.dead = true;
          p.eliminatedAt = payload.eliminatedAt;
          sounds.playHit();
        }
        if (payload.message) showBanner(payload.message);
      } else if (type === 'toggle_door') {
        const door = g.doors.find(d => d.id === payload.doorId);
        if (door) {
          door.isOpen = payload.isOpen;
          (door as any).closeTimer = g.t + 5.0;
          sounds.playDoor(door.isOpen);
        }
      } else if (type === 'game_over') {
        g.over = true;
        if (payload.summary) {
          if (payload.summary.winnerTeam === 'crew') {
            sounds.playVictory();
          } else {
            sounds.playDefeat();
          }
          saveMatchResult(payload.summary);
          onGameOver(payload.summary);
        }
      }
    };

    // WebSocket Incoming Message Handler
    if (ws) {
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          processGameEvent(msg.type, msg);
        } catch (e) {
          console.error('Error handling ws message in game', e);
        }
      };
    }

    // Direct Firebase Real-time Synchronization for Players and Events
    let unsubPlayers: (() => void) | null = null;
    let unsubEvents: (() => void) | null = null;

    if (onlineRoom) {
      const activeMyId = myPlayerId || '';
      unsubPlayers = firebaseMultiplayer.subscribePlayers(onlineRoom.code, activeMyId, (remotePlayers) => {
        if (g.over) return;
        remotePlayers.forEach((remote: Player) => {
          let local = g.players.find(p => p.id === remote.id);
          if (!local) {
            local = {
              ...remote,
              isMe: remote.id === activeMyId,
              isAI: false
            };
            g.players.push(local);
          }
          if (local && !local.isMe) {
            (local as any).targetX = remote.x;
            (local as any).targetY = remote.y;
            local.dir = remote.dir;
            local.hp = remote.hp;
            local.dead = remote.dead;
            local.doneTasks = remote.doneTasks;
            local.correctAnswers = remote.correctAnswers;
            local.shieldEndTime = remote.shieldEndTime;
            local.workUntil = remote.workUntil;
          }
        });
      });

      unsubEvents = firebaseMultiplayer.subscribeEvents(onlineRoom.code, (event: any) => {
        if (g.over) return;
        if (event && event.type && event.payload) {
          processGameEvent(event.type, event.payload);
        }
      });
    }

    // Keyboard handlers
    const keyMap: Record<string, string> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', a: 'left', s: 'down', d: 'right',
      W: 'up', A: 'left', S: 'down', D: 'right'
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (keyMap[e.key]) {
        const k = keyMap[e.key];
        g.keys[k] = true;
        if (g.inputBuffer) g.inputBuffer.keys[k] = true;
      }
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        if (!activeQuiz) {
          interactTask();
        }
      }
      if (e.key === 'q' || e.key === 'Q') {
        if (g.myPlayer) {
          triggerSkill(g.myPlayer);
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        if (g.myPlayer) {
          for (const d of g.doors) {
            const cx = d.x + d.w / 2;
            const cy = d.y + d.h / 2;
            if (Math.hypot(g.myPlayer.x - cx, g.myPlayer.y - cy) < 80) {
              toggleDoor(d.id);
              break;
            }
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keyMap[e.key]) {
        const k = keyMap[e.key];
        g.keys[k] = false;
        if (g.inputBuffer) g.inputBuffer.keys[k] = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Animation Loop
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (!g.over) {
        g.t += dt;

        // 0. Update Pintu Geser Antar Ruangan
        for (const door of g.doors) {
          if (door.isOpen) {
            door.openProgress = Math.min(1.0, door.openProgress + dt * 3.5);
            if (g.t > ((door as any).closeTimer || 0)) {
              door.isOpen = false;
              sounds.playDoor(false);
            }
          } else {
            door.openProgress = Math.max(0.0, door.openProgress - dt * 3.5);
          }
        }

        // 1. Update Crew
        for (const c of g.players.filter(p => p.role === 'crew')) {
          if (c.dead) continue;

          // AI behavior in Solo mode
          if (c.isAI) {
            if (c.aiPending && c.workUntil <= g.t) {
              c.aiPending = false;
              const isAccurate = Math.random() < (c.aiAccuracy || 0.7);
              const answerTime = Number((2.0 + Math.random() * 3.5).toFixed(1));
              c.taskDurations.push(answerTime);
              c.totalAttempts++;

              if (isAccurate && c.targetStation) {
                c.completedBitmask |= (1 << c.targetStation.i);
                c.doneTasks++;
                c.correctAnswers++;
              } else if (c.targetStation) {
                c.wrongAnswers++;
                c.lockedStations[c.targetStation.i] = g.t + 6;
              }
              c.invulnerableUntil = g.t + 1.2;
              checkGameEndCondition();
            }

            if (c.workUntil <= g.t) {
              const nearestImp = g.players.find(p => p.role === 'impostor' && !p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 110);
              if (nearestImp) {
                triggerSkill(c);
              }

              let bestStation: TaskStation | null = null;
              let bestDist = 1e9;
              for (const s of g.stations) {
                if ((c.completedBitmask >> s.i) & 1) continue;
                if ((c.lockedStations[s.i] || 0) > g.t) continue;
                const d = Math.hypot(s.x - c.x, s.y - c.y);
                if (d < bestDist) {
                  bestDist = d;
                  bestStation = s;
                }
              }

              if (bestStation) {
                if (bestDist < 40) {
                  c.workUntil = g.t + 2.5;
                  c.aiPending = true;
                  c.targetStation = bestStation;
                } else {
                  const angle = Math.atan2(bestStation.y - c.y, bestStation.x - c.x);
                  const speed = getSpeed(c);
                  c.dir = Math.cos(angle) > 0 ? 1 : -1;
                  moveEntity(c, Math.cos(angle) * speed * dt, Math.sin(angle) * speed * dt);
                }
              }
            }
          } 
          // Local Player Movement
          else if (c.isMe) {
            if (c.workUntil <= g.t) {
              const keys = g.inputBuffer?.keys || g.keys;
              const joy = g.inputBuffer?.joystick || g.joystickVector;
              let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
              let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
              if (joy && (Math.abs(joy.x) > 0.08 || Math.abs(joy.y) > 0.08)) {
                dx = joy.x;
                dy = joy.y;
              }

              const len = Math.hypot(dx, dy);
              const speed = getSpeed(c);
              let targetVx = 0;
              let targetVy = 0;

              if (len > 0.08) {
                const moveMag = Math.min(1.0, len);
                targetVx = (dx / len) * moveMag * speed;
                targetVy = (dy / len) * moveMag * speed;
                if (dx !== 0) c.dir = dx > 0 ? 1 : -1;
              }

              // Instant acceleration with friction LERP (Roblox/Mobile Legends feel)
              const accelFactor = 1 - Math.exp(-26 * dt);
              c.vx = lerp(c.vx || 0, targetVx, accelFactor);
              c.vy = lerp(c.vy || 0, targetVy, accelFactor);

              if (Math.abs(c.vx) > 0.5 || Math.abs(c.vy) > 0.5) {
                moveEntity(c, c.vx * dt, c.vy * dt);
              } else {
                c.vx = 0;
                c.vy = 0;
              }
            }
          }

          // Impostor collision check
          if (!isSafe(c, g.t)) {
            for (const imp of g.players.filter(p => p.role === 'impostor' && !p.dead)) {
              if (imp.freezeUntil <= g.t && Math.hypot(c.x - imp.x, c.y - imp.y) < 26) {
                damageCrew(c, imp);
                break;
              }
            }
          }
        }

        // 2. Update Impostors
        for (const imp of g.players.filter(p => p.role === 'impostor')) {
          if (imp.dead || imp.freezeUntil > g.t) continue;

          if (imp.isAI) {
            let targetCrew: Player | null = null;
            let minDist = 1e9;
            for (const crewP of g.players.filter(p => p.role === 'crew' && !p.dead)) {
              const d = Math.hypot(crewP.x - imp.x, crewP.y - imp.y);
              if (d < minDist) {
                minDist = d;
                targetCrew = crewP;
              }
            }

            if (targetCrew) {
              const angle = Math.atan2(targetCrew.y - imp.y, targetCrew.x - imp.x);
              imp.angle = angle;
              imp.dir = Math.cos(angle) > 0 ? 1 : -1;

              const chaseSpeed = minDist < 280 ? 130 : 95;
              moveEntity(imp, Math.cos(angle) * chaseSpeed * dt, Math.sin(angle) * chaseSpeed * dt);

              if (minDist < 390 && g.t >= (imp.shootCooldownUntil || 0)) {
                triggerSkill(imp);
              }
            } else {
              // Semua kru telah gugur: Impostor mengerjakan sisa soal di stasiun untuk memenuhi syarat menang!
              let bestStation: TaskStation | null = null;
              let bestDist = 1e9;
              for (const s of g.stations) {
                if ((imp.completedBitmask >> s.i) & 1) continue;
                const d = Math.hypot(s.x - imp.x, s.y - imp.y);
                if (d < bestDist) {
                  bestDist = d;
                  bestStation = s;
                }
              }
              if (bestStation) {
                if (bestDist < 45) {
                  if (imp.workUntil <= g.t) {
                    imp.workUntil = g.t + 2.0;
                    imp.doneTasks++;
                    imp.completedBitmask |= (1 << bestStation.i);
                    checkGameEndCondition();
                  }
                } else {
                  const angle = Math.atan2(bestStation.y - imp.y, bestStation.x - imp.x);
                  imp.angle = angle;
                  imp.dir = Math.cos(angle) > 0 ? 1 : -1;
                  moveEntity(imp, Math.cos(angle) * 120 * dt, Math.sin(angle) * 120 * dt);
                }
              }
            }
          } else if (imp.isMe) {
            if (imp.workUntil <= g.t) {
              const keys = g.inputBuffer?.keys || g.keys;
              const joy = g.inputBuffer?.joystick || g.joystickVector;
              let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
              let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
              if (joy && (Math.abs(joy.x) > 0.08 || Math.abs(joy.y) > 0.08)) {
                dx = joy.x;
                dy = joy.y;
              }

              const len = Math.hypot(dx, dy);
              const speed = getSpeed(imp);
              let targetVx = 0;
              let targetVy = 0;

              if (len > 0.08) {
                const moveMag = Math.min(1.0, len);
                targetVx = (dx / len) * moveMag * speed;
                targetVy = (dy / len) * moveMag * speed;
                if (dx !== 0) imp.dir = dx > 0 ? 1 : -1;
                imp.angle = Math.atan2(dy, dx);
              }

              const accelFactor = 1 - Math.exp(-26 * dt);
              imp.vx = lerp(imp.vx || 0, targetVx, accelFactor);
              imp.vy = lerp(imp.vy || 0, targetVy, accelFactor);

              if (Math.abs(imp.vx) > 0.5 || Math.abs(imp.vy) > 0.5) {
                moveEntity(imp, imp.vx * dt, imp.vy * dt);
              } else {
                imp.vx = 0;
                imp.vy = 0;
              }
            }
          }
        }

        // 3. Update Bullets
        g.bullets = g.bullets.filter(b => {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;
          if (b.life <= 0 || isWallHit(b.x, b.y, 4)) return false;

          for (const crewP of g.players.filter(p => p.role === 'crew' && !p.dead)) {
            if (Math.hypot(crewP.x - b.x, crewP.y - b.y) <= 18) {
              if (crewP.shieldEndTime > g.t) {
                return false;
              }
              if (!isSafe(crewP, g.t)) {
                damageCrew(crewP, null);
                return false;
              }
            }
          }
          return true;
        });

        // 4. Smooth Lerp for Remote Players in Online Mode (Roblox / Mobile Legends exponential LERP)
        for (const p of g.players) {
          if (!p.isMe && !p.isAI) {
            const tx = (p as any).targetX ?? p.remoteTargetX;
            const ty = (p as any).targetY ?? p.remoteTargetY;
            if (typeof tx === 'number' && typeof ty === 'number') {
              const dist = Math.hypot(tx - p.x, ty - p.y);
              if (dist > 300) {
                p.x = tx;
                p.y = ty;
              } else if (dist > 0.5) {
                const lerpFactor = 1 - Math.exp(-18 * dt);
                p.x = lerp(p.x, tx, lerpFactor);
                p.y = lerp(p.y, ty, lerpFactor);
              }
            }
          }
        }

        // 5. Throttled Position Broadcast (~11Hz)
        if (onlineRoom && g.myPlayer && !g.myPlayer.dead) {
          const nowMs = performance.now();
          if (nowMs - g.lastNetSyncTime > 90) {
            g.lastNetSyncTime = nowMs;
            const payload = {
              x: Math.round(g.myPlayer.x),
              y: Math.round(g.myPlayer.y),
              dir: g.myPlayer.dir,
              angle: g.myPlayer.angle,
              workUntil: g.myPlayer.workUntil,
              shieldEndTime: g.myPlayer.shieldEndTime
            };
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'player_update',
                ...payload
              }));
            }
            api.sendAction(onlineRoom.code, 'player_update', payload).catch(() => {});
          }
        }

        // React HUD state
        if (g.myPlayer) {
          setHudLives(g.myPlayer.hp);
          setHudRoom(ROOMS[getRoomAt(g.myPlayer.x, g.myPlayer.y)]);
          setHudSpeed(`x${(getSpeed(g.myPlayer)/200).toFixed(2)}`);
          setShieldCooldownLeft(Math.max(0, Math.ceil(g.myPlayer.shieldCooldownUntil - g.t)));
          setIsShieldActive(g.myPlayer.shieldEndTime > g.t);
          setCanInteractTask(!!findNearStation(g.myPlayer, g.t));

          // Deteksi Pintu Terdekat untuk Interaksi Buka/Tutup
          let closestDoor: RoomDoor | null = null;
          let minD = 85;
          for (const d of g.doors) {
            const cx = d.x + d.w / 2;
            const cy = d.y + d.h / 2;
            const dist = Math.hypot(g.myPlayer.x - cx, g.myPlayer.y - cy);
            if (dist < minD) {
              minD = dist;
              closestDoor = d;
            }
          }
          setNearDoor(closestDoor);
        }

        const crewAlive = g.players.filter(p => p.role === 'crew' && !p.dead).length;
        const impAlive = g.players.filter(p => p.role === 'impostor' && !p.dead).length;
        setSurvivingCrew(crewAlive);
        setSurvivingImps(impAlive);
      }

      drawCanvas();

      if (!g.over) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (unsubPlayers) unsubPlayers();
      if (unsubEvents) unsubEvents();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [config, isSpectator, playerName, playerClass, checkGameEndCondition, damageCrew, interactTask, triggerSkill, showBanner, ws, onlineRoom, initialOnlinePlayers, initialStations, myPlayerId]);

  // Canvas Drawing
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const g = gameRef.current;
    const cw = canvas.width;
    const ch = canvas.height;
    const t = g.t;

    let targetEntity: Player | null = g.myPlayer;
    if (isSpectator) {
      if (spectatorTargetId) {
        targetEntity = g.players.find(p => p.id === spectatorTargetId) || null;
      } else {
        targetEntity = null;
      }
    }

    let scale = 1;
    let cx = 0;
    let cy = 0;
    let ox = 0;
    let oy = 0;

    if (targetEntity) {
      cx = Math.max(0, Math.min(W - cw, targetEntity.x - cw / 2));
      cy = Math.max(0, Math.min(H - ch, targetEntity.y - ch / 2));
    } else {
      scale = Math.min(cw / W, ch / H);
      ox = (cw - W * scale) / 2;
      oy = (ch - H * scale) / 2;
    }

    ctx.fillStyle = '#0d1914';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // 6 Rooms
    for (let i = 0; i < 6; i++) {
      const rx = (i % 3) * RS;
      const ry = Math.floor(i / 3) * RS;

      ctx.fillStyle = FLOOR_COLORS[i];
      ctx.fillRect(rx, ry, RS, RS);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let k = 60; k < RS; k += 60) {
        ctx.beginPath();
        ctx.moveTo(rx + k, ry);
        ctx.lineTo(rx + k, ry + RS);
        ctx.moveTo(rx, ry + k);
        ctx.lineTo(rx + RS, ry + k);
        ctx.stroke();
      }

      drawFurniture(ctx, i, rx, ry);

      ctx.fillStyle = "rgba(243, 239, 220, 0.55)";
      ctx.font = "600 24px 'Fredoka', system-ui";
      ctx.textAlign = "left";
      ctx.fillText(ROOMS[i], rx + 28, ry + 44);
    }

    // Walls
    ctx.fillStyle = '#6c8f7c';
    for (const w of BASE_WALLS) {
      ctx.fillRect(w[0], w[1], w[2], w[3]);
    }

    // Room Doors
    for (const d of g.doors) {
      drawDoor(ctx, d, t);
    }

    // Stations
    for (const s of g.stations) {
      const viewer = g.myPlayer;
      const isDone = viewer ? !!((viewer.completedBitmask >> s.i) & 1) : false;
      const isLocked = viewer ? (viewer.lockedStations[s.i] || 0) > t : false;

      ctx.fillStyle = isDone ? "#4f9b69" : isLocked ? "#8a4a42" : "#f5d547";
      ctx.fillRect(s.x - 18, s.y - 14, 36, 28);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(s.x - 18, s.y + 8, 36, 6);

      ctx.fillStyle = "#2a2406";
      ctx.font = "700 18px 'Fredoka', system-ui";
      ctx.textAlign = "center";
      ctx.fillText(isDone ? "✓" : isLocked ? "✕" : "?", s.x, s.y + 6);

      if (!isDone && !isLocked) {
        ctx.strokeStyle = "rgba(245, 213, 71, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 28 + 3 * Math.sin(t * 4), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Players (depth sorted)
    const renderItems = [...g.players].map(p => ({
      y: p.y,
      draw: () => {
        ctx.globalAlpha = p.dead ? 0.3 : (p.invulnerableUntil > t && Math.floor(t * 10) % 2 === 0 ? 0.5 : 1.0);
        drawCharacter(ctx, p, t);
        ctx.globalAlpha = 1.0;
      }
    }));

    renderItems.sort((a, b) => a.y - b.y).forEach(item => item.draw());

    // Bullets
    ctx.fillStyle = '#ff8a5c';
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // Draw Character with Nickname and Kelas
  const drawCharacter = (ctx: CanvasRenderingContext2D, p: Player, t: number) => {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Impostor laser gun direction
    if (p.role === 'impostor') {
      const angle = p.angle || 0;
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(Math.cos(angle) * 24, 2 + Math.sin(angle) * 24);
      ctx.stroke();
    }

    // Body
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();

    // Eyes
    ctx.fillStyle = "#fff";
    [-5, 5].forEach(ex => {
      ctx.beginPath();
      ctx.arc(ex + p.dir * 2, -2, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#111";
    [-5, 5].forEach(ex => {
      ctx.beginPath();
      ctx.arc(ex + p.dir * 3.5, -2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Hat / Eyebrows
    if (p.role === 'impostor') {
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -9);
      ctx.lineTo(-2, -6);
      ctx.moveTo(10, -9);
      ctx.lineTo(2, -6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#1b1b1b";
      ctx.fillRect(-11, -19, 22, 5);
      ctx.beginPath();
      ctx.moveTo(-14, -15);
      ctx.lineTo(0, -24);
      ctx.lineTo(14, -15);
      ctx.closePath();
      ctx.fill();
    }

    // Display Nickname and Kelas badge (Contoh: "Budi [7A] (Kamu)")
    ctx.fillStyle = p.isMe ? "#f5d547" : "#f3efdc";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    const classBadge = p.playerClass ? ` [${p.playerClass}]` : '';
    ctx.fillText(`${p.name}${classBadge}${p.isMe ? " (Kamu)" : ""}`, 0, -28);

    // Active Shield Bubble
    if (p.shieldEndTime > t && !p.dead) {
      ctx.fillStyle = "rgba(90, 200, 255, 0.25)";
      ctx.strokeStyle = "#7fdcff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Working at Station indicator
    if (p.workUntil > t && !p.dead) {
      ctx.fillStyle = "#f5d547";
      ctx.font = "bold 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("✎ …", 0, -44);
    }

    ctx.restore();
  };

  // Furniture Helper: Menggambar Labirin Mini Perabotan Sesuai Tema Ruangan
  const drawFurniture = (ctx: CanvasRenderingContext2D, roomIdx: number, rx: number, ry: number) => {
    ctx.save();
    // Helper shapes menggambar di koordinat absolut ruangan
    const R = (c: string, a: number, b: number, w: number, h: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(rx + a, ry + b, w, h);
    };
    const C = (c: string, a: number, b: number, r: number) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(rx + a, ry + b, r, 0, Math.PI * 2);
      ctx.fill();
    };

    if (roomIdx === 0) { // Perpustakaan (0 - 600, 0 - 600) -> Labirin Rak Buku
      // Rak Buku Utara 1 (x: 50, y: 55, w: 200, h: 42) & Utara 2 (x: 350, y: 55, w: 200, h: 42)
      [50, 350].forEach(shelfX => {
        R("#5b3d22", shelfX, 55, 200, 42);
        R("#7a5230", shelfX + 4, 58, 192, 36);
        for (let k = 0; k < 18; k++) {
          R(["#c0504d", "#4f81bd", "#9bbb59", "#f5d547", "#8c564b"][k % 5], shelfX + 8 + k * 10, 60, 8, 30);
        }
      });
      // Rak Ensiklopedia Barat (x: 130, y: 160, w: 42, h: 220) & Timur (x: 428, y: 160, w: 42, h: 220)
      [130, 428].forEach(stackX => {
        R("#5b3d22", stackX, 160, 42, 220);
        R("#7a5230", stackX + 3, 163, 36, 214);
        for (let k = 0; k < 15; k++) {
          R(["#c0504d", "#4f81bd", "#9bbb59", "#e8a33d"][k % 4], stackX + 5, 166 + k * 14, 32, 10);
        }
      });
      // Meja Belajar Utama (x: 235, y: 240, w: 130, h: 65)
      R("#6b4321", 235, 240, 130, 65);
      R("#8d5930", 238, 243, 124, 59);
      C("#f5d547", 260, 272, 6);
      C("#f5d547", 340, 272, 6);
      R("#ffffff", 285, 260, 30, 24);
      C("#4a2e18", 225, 272, 8);
      C("#4a2e18", 375, 272, 8);

      // Sofa Baca Perpustakaan (x: 235, y: 390, w: 130, h: 45)
      R("#7a3030", 235, 390, 130, 45);
      R("#9c4242", 238, 393, 124, 39);
      R("#612323", 235, 390, 15, 45);
      R("#612323", 350, 390, 15, 45);
    } else if (roomIdx === 1) { // Laboratorium (600 - 1200, 0 - 600) -> Labirin Meja Reagen & Mikroskop
      // Meja Reagen Utara 1 & 2
      [60, 330].forEach(bx => {
        R("#cfd8dc", bx, 55, 210, 44);
        R("#90a4ae", bx, 55, 210, 8);
        for (let k = 0; k < 6; k++) {
          C(["#e74c3c", "#3498db", "#2ecc71", "#f1c40f"][k % 4], bx + 25 + k * 32, 75, 7);
        }
      });
      // Meja Praktikum Barat & Timur
      [130, 345].forEach(mx => {
        R("#b0bec5", mx, 175, 125, 65);
        R("#eceff1", mx + 3, 178, 119, 59);
        R("#263238", mx + 25, 195, 16, 16);
        R("#263238", mx + 85, 195, 16, 16);
        C("#37474f", mx + 33, 190, 6);
        C("#37474f", mx + 93, 190, 6);
      });
      // Lemari Asam Lab (70, 430, 140, 50)
      R("#37474f", 70, 430, 140, 50);
      R("#78909c", 75, 435, 130, 40);
      R("#80deea", 85, 440, 110, 24);
      // Meja Centrifuge & Alat (390, 430, 140, 50)
      R("#cfd8dc", 390, 430, 140, 50);
      C("#546e7a", 430, 455, 14);
      C("#546e7a", 490, 455, 14);
      C("#e0e0e0", 430, 455, 8);
      C("#e0e0e0", 490, 455, 8);
    } else if (roomIdx === 2) { // Kantin (1200 - 1800, 0 - 600) -> Labirin Prasmanan & Meja Makan
      // Counter Prasmanan
      R("#8a5d34", 60, 55, 480, 44);
      R("#c28d55", 60, 55, 480, 8);
      for (let k = 0; k < 10; k++) {
        R(["#e8a33d", "#c0504d", "#9bbb59", "#d4ac0d"][k % 4], 85 + k * 44, 70, 28, 18);
      }
      // Meja Makan 1, 2, 3
      [[110, 180], [390, 180], [110, 380]].forEach(([tx, ty]) => {
        R("#6b4a2b", tx, ty, 90, 70);
        R("#8d5930", tx + 4, ty + 4, 82, 62);
        C("#3b3b3b", tx + 20, ty - 6, 8);
        C("#3b3b3b", tx + 70, ty - 6, 8);
        C("#3b3b3b", tx + 20, ty + 76, 8);
        C("#3b3b3b", tx + 70, ty + 76, 8);
      });
      // Kedai Minuman
      R("#2c3e50", 490, 310, 48, 180);
      R("#34495e", 494, 314, 40, 172);
      for (let k = 0; k < 6; k++) {
        C(["#e74c3c", "#f39c12", "#1abc9c"][k % 3], 514, 330 + k * 26, 7);
      }
    } else if (roomIdx === 3) { // Aula (0 - 600, 600 - 1200) -> Labirin Baris Kursi Aula & Panggung
      // Panggung Utama Aula
      R("#261738", 60, 500, 480, 60);
      R("#522146", 60, 500, 480, 10);
      R("#854374", 60, 500, 30, 60);
      R("#854374", 510, 500, 30, 60);
      R("#f5d547", 220, 520, 160, 6);
      // 4 Baris Kursi Aula dengan celah lorong
      [60, 370].forEach(kx => {
        R("#5e4a80", kx, 90, 170, 30);
        R("#463365", kx + 2, 92, 166, 26);
      });
      R("#5e4a80", 150, 170, 300, 30);
      R("#463365", 152, 172, 296, 26);
      [60, 370].forEach(kx => {
        R("#5e4a80", kx, 250, 170, 30);
        R("#463365", kx + 2, 252, 166, 26);
      });
      R("#5e4a80", 150, 330, 300, 30);
      R("#463365", 152, 332, 296, 26);
      // Meja Operator Audio
      R("#222", 60, 420, 85, 40);
      R("#333", 64, 424, 77, 32);
      for (let k = 0; k < 5; k++) {
        C(["#2ecc71", "#e74c3c", "#f1c40f"][k % 3], 75 + k * 14, 440, 3);
      }
    } else if (roomIdx === 4) { // Ruang Kelas (600 - 1200, 600 - 1200) -> Labirin Meja Belajar Siswa
      // Papan Tulis & Meja Guru
      R("#1e3d29", 180, 15, 240, 10);
      R("#6b4a2b", 200, 65, 200, 40);
      R("#8d5930", 204, 69, 192, 32);
      // 6 Kelompok Meja Siswa
      const studentDesks = [
        [70, 145, 90, 50],
        [440, 145, 90, 50],
        [140, 265, 110, 50],
        [350, 265, 110, 50],
        [70, 390, 90, 50],
        [440, 390, 90, 50]
      ];
      studentDesks.forEach(([dx, dy, dw, dh]) => {
        R("#8d5930", dx, dy, dw, dh);
        R("#a87140", dx + 3, dy + 3, dw - 6, dh - 6);
        C("#543d2b", dx + 20, dy - 6, 7);
        C("#543d2b", dx + dw - 20, dy - 6, 7);
        C("#543d2b", dx + 20, dy + dh + 6, 7);
        C("#543d2b", dx + dw - 20, dy + dh + 6, 7);
      });
      // Lemari Arsip Kelas
      R("#455a64", 260, 520, 80, 36);
      R("#607d8b", 263, 523, 74, 30);
    } else if (roomIdx === 5) { // Taman (1200 - 1800, 600 - 1200) -> Labirin Semak Pagar Hijau
      // Pagar Semak
      [ [90, 90, 180, 34], [360, 90, 170, 34], [250, 370, 180, 34] ].forEach(([hx, hy, hw, hh]) => {
        R("#1b5e20", hx, hy, hw, hh);
        R("#2e7d32", hx + 3, hy + 3, hw - 6, hh - 6);
        for (let k = 0; k < hw; k += 24) {
          C("#4caf50", hx + k + 10, hy + 12, 6);
          C("#81c784", hx + k + 16, hy + 22, 5);
        }
      });
      // Kolam Ikan Koi
      R("#78909c", 250, 210, 130, 80);
      ctx.fillStyle = "#1976d2";
      ctx.beginPath();
      ctx.ellipse(rx + 315, ry + 250, 55, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      C("#ff9800", 305, 245, 4);
      C("#ff5722", 325, 255, 4);
      C("#388e3c", 285, 240, 6);
      C("#388e3c", 345, 260, 6);

      // Gazebo Santai
      R("#5d4037", 90, 360, 90, 65);
      R("#8d6e63", 94, 364, 82, 57);
      R("#3e2723", 90, 360, 90, 8);

      // Pohon Rindang
      [[70, 510], [515, 510], [515, 170]].forEach(([px, py]) => {
        C("#1b5e20", px + 27, py + 27, 28);
        C("#2e7d32", px + 22, py + 22, 22);
        C("#388e3c", px + 16, py + 16, 14);
      });
    }

    ctx.restore();
  };

  // Door Renderer: Menggambar Pintu Geser Antar-Ruangan dengan Animasi Geser & Indikator
  const drawDoor = (ctx: CanvasRenderingContext2D, d: RoomDoor, t: number) => {
    ctx.save();
    const isHoriz = d.orientation === 'horizontal';

    // Rangka Kusen Pintu
    ctx.fillStyle = "#16201b";
    ctx.fillRect(d.x - 2, d.y - 2, d.w + 4, d.h + 4);

    // Garis Hazard Kuning di Ambang Pintu
    ctx.strokeStyle = "rgba(245, 213, 71, 0.35)";
    ctx.lineWidth = 2;
    if (isHoriz) {
      for (let sx = d.x; sx < d.x + d.w; sx += 16) {
        ctx.beginPath();
        ctx.moveTo(sx, d.y);
        ctx.lineTo(sx + 8, d.y + d.h);
        ctx.stroke();
      }
    } else {
      for (let sy = d.y; sy < d.y + d.h; sy += 16) {
        ctx.beginPath();
        ctx.moveTo(d.x, sy);
        ctx.lineTo(d.x + d.w, sy + 8);
        ctx.stroke();
      }
    }

    // Daun Pintu Geser Terbuka / Tertutup
    const slideOffset = (isHoriz ? d.w / 2 : d.h / 2) * d.openProgress;

    if (isHoriz) {
      const halfW = d.w / 2;
      // Panel Kiri
      ctx.fillStyle = "#3e574c";
      ctx.fillRect(d.x - slideOffset, d.y, halfW, d.h);
      ctx.fillStyle = "#273931";
      ctx.fillRect(d.x - slideOffset + 2, d.y + 2, halfW - 4, d.h - 4);
      ctx.fillStyle = "#f5d547";
      ctx.fillRect(d.x - slideOffset + halfW - 6, d.y + 4, 3, d.h - 8);

      // Panel Kanan
      ctx.fillStyle = "#3e574c";
      ctx.fillRect(d.x + halfW + slideOffset, d.y, halfW, d.h);
      ctx.fillStyle = "#273931";
      ctx.fillRect(d.x + halfW + slideOffset + 2, d.y + 2, halfW - 4, d.h - 4);
      ctx.fillStyle = "#f5d547";
      ctx.fillRect(d.x + halfW + slideOffset + 3, d.y + 4, 3, d.h - 8);

      // Lampu Status Sensor Pintu
      ctx.fillStyle = d.openProgress >= 0.7 ? "#6fd08c" : "#f5d547";
      ctx.beginPath();
      ctx.arc(d.x + halfW, d.y + d.h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const halfH = d.h / 2;
      // Panel Atas
      ctx.fillStyle = "#3e574c";
      ctx.fillRect(d.x, d.y - slideOffset, d.w, halfH);
      ctx.fillStyle = "#273931";
      ctx.fillRect(d.x + 2, d.y - slideOffset + 2, d.w - 4, halfH - 4);
      ctx.fillStyle = "#f5d547";
      ctx.fillRect(d.x + 4, d.y - slideOffset + halfH - 6, d.w - 8, 3);

      // Panel Bawah
      ctx.fillStyle = "#3e574c";
      ctx.fillRect(d.x, d.y + halfH + slideOffset, d.w, halfH);
      ctx.fillStyle = "#273931";
      ctx.fillRect(d.x + 2, d.y + halfH + slideOffset + 2, d.w - 4, halfH - 4);
      ctx.fillStyle = "#f5d547";
      ctx.fillRect(d.x + 4, d.y + halfH + slideOffset + 3, d.w - 8, 3);

      // Lampu Status Sensor Pintu
      ctx.fillStyle = d.openProgress >= 0.7 ? "#6fd08c" : "#f5d547";
      ctx.beginPath();
      ctx.arc(d.x + d.w / 2, d.y + halfH, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nama Pintu saat tertutup
    if (d.openProgress < 0.7) {
      ctx.fillStyle = "rgba(245, 213, 71, 0.85)";
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(d.name, d.x + d.w / 2, d.y - 4);
    }

    ctx.restore();
  };

  const handleDpadDown = (key: string) => {
    gameRef.current.keys[key] = true;
    if (gameRef.current.inputBuffer) gameRef.current.inputBuffer.keys[key] = true;
  };
  const handleDpadUp = (key: string) => {
    gameRef.current.keys[key] = false;
    if (gameRef.current.inputBuffer) gameRef.current.inputBuffer.keys[key] = false;
  };

  const bindDpad = (dirKey: string) => {
    const press = (e: React.SyntheticEvent) => {
      if (e.cancelable) e.preventDefault();
      gameRef.current.keys[dirKey] = true;
      if (gameRef.current.inputBuffer) gameRef.current.inputBuffer.keys[dirKey] = true;
    };
    const release = (e: React.SyntheticEvent) => {
      if (e.cancelable) e.preventDefault();
      gameRef.current.keys[dirKey] = false;
      if (gameRef.current.inputBuffer) gameRef.current.inputBuffer.keys[dirKey] = false;
    };
    return {
      onMouseDown: press,
      onMouseUp: release,
      onMouseLeave: release,
      onTouchStart: press,
      onTouchEnd: release,
      onTouchCancel: release
    };
  };

  const isImpostor = gameRef.current.myPlayer?.role === 'impostor';

  return (
    <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center">
      
      {/* Top HUD Bar */}
      <div className="w-full bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl px-4 py-2.5 mb-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-md">
        
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg bg-[#14261f] border border-[#335a49] text-[#a9bdb2] hover:text-[#f3efdc] transition-colors flex items-center gap-1"
            title="Keluar ke Lobi / Menu"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>

          <button
            onClick={() => setSoundOn(sounds.toggleSound())}
            className="p-1.5 rounded-lg bg-[#14261f] border border-[#335a49] text-[#a9bdb2] hover:text-[#f3efdc] transition-colors"
            title="Suara"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-[#ef6b5b]" />}
          </button>

          {onlineRoom && (
            <div className="hidden md:flex items-center gap-1 text-[11px] bg-[#14261f] px-2 py-0.5 rounded border border-[#335a49]">
              <span className="text-[#a9bdb2]">Room:</span>
              <strong className="text-[#f5d547] font-mono">{onlineRoom.code}</strong>
            </div>
          )}
        </div>

        {/* Status Nyawa & Peran */}
        <div className="flex items-center gap-4">
          {!isSpectator ? (
            <div className="flex items-center gap-1 font-bold">
              <span className="text-[#a9bdb2] text-xs hidden sm:inline">
                {isImpostor ? 'Peran: ' : 'Nyawa: '}
              </span>
              {isImpostor ? (
                <span className="text-[#ef6b5b] font-bold flex items-center gap-1">
                  <Skull className="w-4 h-4" />
                  Penyusup
                </span>
              ) : (
                <span className="text-[#ef6b5b] tracking-wider text-base">
                  {"♥".repeat(Math.max(0, hudLives))}
                  {"♡".repeat(Math.max(0, config.crewLives - hudLives))}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[#f5d547] font-semibold">
              <Eye className="w-4 h-4" />
              <span>Spektator</span>
            </div>
          )}

          {/* Indikator Tim Tersisa */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#14261f] border border-[#335a49] text-xs font-semibold tabular-nums">
            <span className="text-[#6fd08c] flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Kru: {survivingCrew}/{totalCrew}
            </span>
            <span className="text-[#335a49]">|</span>
            <span className="text-[#ef6b5b] flex items-center gap-1">
              <Skull className="w-3.5 h-3.5" />
              Penyusup: {survivingImps}/{config.impostorsCount}
            </span>
          </div>
        </div>

        {/* Status Lokasi & Skill */}
        <div className="flex items-center gap-2">
          {!isSpectator && (
            <button
              onClick={() => gameRef.current.myPlayer && triggerSkill(gameRef.current.myPlayer)}
              disabled={shieldCooldownLeft > 0}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 ${
                isImpostor
                  ? 'bg-[#e0463c] text-white border border-[#ff8a5c] hover:bg-[#b8332a]'
                  : isShieldActive 
                  ? 'bg-[#7fdcff] text-[#0a2332] shadow-lg animate-pulse'
                  : shieldCooldownLeft <= 0 
                  ? 'bg-[#2b6f8f] text-[#f3efdc] border border-[#7fdcff] hover:bg-[#3486ad]' 
                  : 'bg-[#14261f] text-[#a9bdb2] opacity-50 cursor-not-allowed border border-[#335a49]'
              }`}
            >
              {isImpostor ? <Skull className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              <span>
                {isImpostor
                  ? 'Tembak Laser (Q)'
                  : isShieldActive 
                  ? 'Tameng Aktif' 
                  : shieldCooldownLeft > 0 
                  ? `${shieldCooldownLeft}s (Q)` 
                  : 'Tameng (Q)'}
              </span>
            </button>
          )}

          <div className="text-right text-[#a9bdb2] hidden md:block">
            <div className="font-semibold text-[#f3efdc]">{hudRoom}</div>
            <div className="text-[11px]">Kec: {hudSpeed}</div>
          </div>
        </div>

      </div>

      {/* Canvas Viewport */}
      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-[#335a49] shadow-2xl bg-[#0d1914]">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-auto block select-none"
        />

        {/* In-Game Announcement Message */}
        {bannerMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/85 border border-[#335a49] text-xs sm:text-sm font-semibold text-[#f5d547] shadow-xl pointer-events-none transition-all duration-300">
            {bannerMsg}
          </div>
        )}

        {/* Action Prompts */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col sm:flex-row items-center gap-2 pointer-events-auto">
          {nearDoor && (
            <button
              onClick={() => toggleDoor(nearDoor.id)}
              className="px-4 py-2 rounded-xl bg-[#294237] border-2 border-[#f5d547] text-[#f3efdc] font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-bounce cursor-pointer hover:bg-[#345245]"
            >
              <DoorOpen className="w-4 h-4 text-[#f5d547]" />
              <span>[F] {nearDoor.isOpen ? 'Tutup' : 'Buka'} {nearDoor.name}</span>
            </button>
          )}

          {canInteractTask && !activeQuiz && (
            <button
              onClick={interactTask}
              className="px-4 py-2 rounded-xl bg-[#f5d547] text-[#14261f] font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-bounce cursor-pointer hover:bg-[#fad85e]"
            >
              <Zap className="w-4 h-4" />
              <span>[E] / [Spasi] Kerjakan Tugas</span>
            </button>
          )}
        </div>
      </div>

      {/* Spectator Target Selector */}
      {isSpectator && (
        <div className="w-full mt-3 p-2 bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[#a9bdb2] font-semibold mr-1">Fokus Kamera:</span>
          <button
            onClick={() => setSpectatorTargetId(null)}
            className={`px-3 py-1 rounded-lg border transition-colors ${
              spectatorTargetId === null ? 'bg-[#f5d547] text-[#14261f] font-bold border-[#f5d547]' : 'bg-[#14261f] text-[#a9bdb2] border-[#335a49]'
            }`}
          >
            Peta Penuh
          </button>
          {gameRef.current.players.map(p => (
            <button
              key={p.id}
              onClick={() => setSpectatorTargetId(p.id)}
              className={`px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                spectatorTargetId === p.id ? 'bg-[#335a49] text-white font-bold border-[#6fd08c]' : 'bg-[#14261f] text-[#a9bdb2] border-[#335a49]'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span>{p.name} {p.playerClass && `[${p.playerClass}]`}</span>
              {p.dead && <span className="text-[#ef6b5b]">(Gugur)</span>}
            </button>
          ))}
        </div>
      )}

      {/* Controls Hint & Mobile Virtual D-Pad */}
      <div className="w-full mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#a9bdb2]">
        <div className="hidden sm:block">
          Gerak: <strong>WASD / Panah</strong> · Tugas: <strong>E / Spasi</strong> · Buka Pintu: <strong>F</strong> · Skill: <strong>Q</strong>
        </div>

        {/* Mobile Touch Controls for Android & Mobile Devices */}
        <div className="flex sm:hidden flex-col items-center w-full px-2 py-1 gap-2">
          {/* Mode Switcher: Joystick 360 vs D-Pad */}
          <div className="flex items-center justify-between w-full text-[11px] font-semibold px-1 text-[#a9bdb2]">
            <span>Kontrol Mobile:</span>
            <div className="flex items-center gap-1 bg-[#14261f] p-0.5 rounded-lg border border-[#335a49]">
              <button
                onClick={() => setControlMode('joystick')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  controlMode === 'joystick'
                    ? 'bg-[#f5d547] text-[#14261f] font-bold shadow'
                    : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                🕹️ Joystick 360° (ML)
              </button>
              <button
                onClick={() => setControlMode('dpad')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  controlMode === 'dpad'
                    ? 'bg-[#f5d547] text-[#14261f] font-bold shadow'
                    : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                🎮 D-Pad (Roblox)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between w-full">
            {controlMode === 'joystick' ? (
              <JoystickControl
                onMove={(vector) => {
                  gameRef.current.joystickVector = vector;
                  if (gameRef.current.inputBuffer) gameRef.current.inputBuffer.joystick = vector;
                }}
              />
            ) : (
              <div className="grid grid-cols-3 grid-rows-3 gap-1 w-36 h-36 select-none touch-none">
                <div></div>
                <button
                  {...bindDpad('up')}
                  className="bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-center justify-center text-xl text-[#f3efdc] active:bg-[#f5d547] active:text-[#14261f] shadow select-none touch-none cursor-pointer"
                >
                  ▲
                </button>
                <div></div>
                <button
                  {...bindDpad('left')}
                  className="bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-center justify-center text-xl text-[#f3efdc] active:bg-[#f5d547] active:text-[#14261f] shadow select-none touch-none cursor-pointer"
                >
                  ◀
                </button>
                <div className="flex items-center justify-center text-[10px] text-[#335a49]">
                  <Gamepad2 className="w-5 h-5 text-[#335a49]" />
                </div>
                <button
                  {...bindDpad('right')}
                  className="bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-center justify-center text-xl text-[#f3efdc] active:bg-[#f5d547] active:text-[#14261f] shadow select-none touch-none cursor-pointer"
                >
                  ▶
                </button>
                <div></div>
                <button
                  {...bindDpad('down')}
                  className="bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-center justify-center text-xl text-[#f3efdc] active:bg-[#f5d547] active:text-[#14261f] shadow select-none touch-none cursor-pointer"
                >
                  ▼
                </button>
                <div></div>
              </div>
            )}

            <div className="flex flex-row items-center gap-2">
              {/* Tombol Buka Pintu (Mobile) */}
              <button
                onClick={() => {
                  if (nearDoor) {
                    toggleDoor(nearDoor.id);
                  } else if (gameRef.current.doors) {
                    const p = gameRef.current.myPlayer;
                    if (p) {
                      const nearest = gameRef.current.doors.find(d => Math.hypot(p.x - (d.x + d.w/2), p.y - (d.y + d.h/2)) < 90);
                      if (nearest) toggleDoor(nearest.id);
                    }
                  }
                }}
                className={`w-14 h-14 rounded-2xl font-bold text-xs flex flex-col items-center justify-center shadow active:scale-95 transition-all ${
                  nearDoor ? 'bg-[#294237] border-2 border-[#f5d547] text-[#f5d547]' : 'bg-[#1d3a2f] border border-[#335a49] text-[#a9bdb2] opacity-70'
                }`}
              >
                <DoorOpen className="w-4 h-4 mb-0.5" />
                Pintu
              </button>

              {/* Tombol Skill (Mobile) */}
              <button
                onClick={() => gameRef.current.myPlayer && triggerSkill(gameRef.current.myPlayer)}
                className="w-14 h-14 rounded-2xl bg-[#2b6f8f] border-2 border-[#7fdcff] text-[#f3efdc] font-bold text-xs flex flex-col items-center justify-center shadow active:scale-95"
              >
                {isImpostor ? <Skull className="w-4 h-4 mb-0.5" /> : <Shield className="w-4 h-4 mb-0.5" />}
                {isImpostor ? 'Tembak' : 'Tameng'}
              </button>

              {/* Tombol Tugas (Mobile) */}
              <button
                onClick={interactTask}
                disabled={!canInteractTask}
                className={`w-14 h-14 rounded-2xl font-bold text-xs flex flex-col items-center justify-center shadow active:scale-95 transition-all ${
                  canInteractTask ? 'bg-[#f5d547] text-[#14261f] ring-2 ring-[#f5d547]/50' : 'bg-[#1d3a2f] border border-[#335a49] text-[#a9bdb2] opacity-40'
                }`}
              >
                <Zap className="w-4 h-4 mb-0.5" />
                Tugas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Modal */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl text-[#f3efdc] animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#335a49] pb-3 mb-4">
              <span className="text-xs font-semibold text-[#f5d547] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Stasiun Tugas: {ROOMS[gameRef.current.stations[activeQuiz.stationIndex]?.roomIndex || 0]}
              </span>
              <span className="text-[11px] text-[#6fd08c] font-medium bg-[#14261f] px-2 py-0.5 rounded">
                Aman saat mengerjakan
              </span>
            </div>

            <p className="text-base sm:text-lg font-medium mb-5 leading-relaxed">
              {activeQuiz.question.q}
            </p>

            <div className="grid gap-2.5">
              {activeQuiz.shuffledOptions.map((opt, i) => {
                const isSelected = activeQuiz.selectedIdx === i;
                const isRightKey = opt.origIdx === activeQuiz.question.a;
                
                let btnStyle = 'bg-[#14261f] text-[#f3efdc] border-[#335a49] hover:border-[#f5d547]';
                if (activeQuiz.answered) {
                  if (isRightKey) {
                    btnStyle = 'bg-[#6fd08c] text-[#0f2e1b] font-bold border-[#6fd08c]';
                  } else if (isSelected) {
                    btnStyle = 'bg-[#ef6b5b] text-[#2b0d08] font-bold border-[#ef6b5b]';
                  } else {
                    btnStyle = 'bg-[#14261f]/50 text-[#a9bdb2] opacity-50 border-transparent';
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswerOption(i)}
                    disabled={activeQuiz.answered}
                    className={`w-full p-3.5 rounded-xl border-2 text-left text-sm transition-all flex items-center justify-between ${btnStyle}`}
                  >
                    <span>
                      <strong className="mr-2 font-mono">{String.fromCharCode(65 + i)}.</strong>
                      {opt.text}
                    </span>
                    {activeQuiz.answered && isRightKey && (
                      <span className="text-xs font-bold">✓ Benar</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
