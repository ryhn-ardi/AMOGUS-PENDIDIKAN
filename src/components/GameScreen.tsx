import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Question, TaskStation, GameBullet, GameConfig, MatchSummary, OnlineRoomData } from '../types/game';
import { sounds } from '../utils/sound';
import { calculateLeaderboard, saveMatchResult } from '../utils/leaderboard';
import { Shield, Skull, Eye, Volume2, VolumeX, LogOut, CheckCircle, Zap } from 'lucide-react';
import { api } from '../utils/network';

interface Props {
  questions: Question[];
  config: GameConfig;
  isSpectator: boolean;
  playerName: string;
  playerClass?: string;
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

const SP6: [number, number][] = [
  [300, 300], [900, 300], [1500, 300],
  [300, 900], [900, 900], [1500, 900]
];
const SP12: [number, number][] = SP6.flatMap(p => [
  [p[0] - 130, p[1]],
  [p[0] + 130, p[1]]
]);

const CP: [number, number][] = [
  [900, 450], [900, 750], [780, 450], [1020, 450],
  [780, 750], [1020, 750], [900, 520], [900, 680], [840, 600], [960, 600]
];
const IP: [number, number][] = [
  [100, 100], [1700, 1100], [1700, 100], [100, 1100]
];

const BOT_CREW_NAMES = ["Rani", "Budi", "Sari", "Dimas", "Alya", "Reza", "Putri", "Gilang"];
const BOT_CLASSES = ["7A", "7B", "8A", "8B", "9A", "9C"];
const BOT_IMP_NAMES = ["Bayangan", "Penyusup Hitam", "Hantu Sekolah", "Mr. X"];
const CREW_COLORS = ["#4aa3df", "#e8a33d", "#b57edc", "#5cc98a", "#4dd0c4", "#f08ca8", "#8fb4ff", "#c5e063"];

export const GameScreen: React.FC<Props> = ({
  questions,
  config,
  isSpectator,
  playerName,
  playerClass = 'Umum',
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

  // Mutable Game Loop State
  const gameRef = useRef<{
    t: number;
    over: boolean;
    bullets: GameBullet[];
    stations: TaskStation[];
    players: Player[];
    myPlayer: Player | null;
    keys: Record<string, boolean>;
    deck: number[];
    quizStartTime: number;
    activeStationIndex: number | null;
    lastNetSyncTime: number;
  }>({
    t: 0,
    over: false,
    bullets: [],
    stations: [],
    players: [],
    myPlayer: null,
    keys: {},
    deck: [],
    quizStartTime: 0,
    activeStationIndex: null,
    lastNetSyncTime: 0
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
    for (const w of BASE_WALLS) {
      const cx = Math.max(w[0], Math.min(x, w[0] + w[2]));
      const cy = Math.max(w[1], Math.min(y, w[1] + w[3]));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    return false;
  };

  const moveEntity = (p: Player, dx: number, dy: number, r = 13) => {
    if (!isWallHit(p.x + dx, p.y, r)) p.x += dx;
    if (!isWallHit(p.x, p.y + dy, r)) p.y += dy;
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

    // Kondisi 1: SEMUA KRU GUGUR (Kru yang tersisa = 0) -> Tim Penyusup Menang!
    if (survivingCrewPlayers.length === 0) {
      winnerTeam = 'impostor';
      winnerTitle = '🚨 TIM PENYUSUP MENANG!';
      reason = `Semua kru tertangkap! Tidak ada detektif kru yang tersisa (${survivingCrewPlayers.length}/${totalCrewPlayers.length} kru). Penyusup berhasil bertahan dan menguasai sekolah.`;
    }
    // Kondisi 2: SEMUA PENYUSUP GUGUR (Penyusup yang tersisa = 0) -> Tim Kru Menang!
    else if (survivingImpPlayers.length === 0) {
      winnerTeam = 'crew';
      winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
      reason = `Semua penyusup tertangkap! Kru yang tersisa (${survivingCrewPlayers.length}/${totalCrewPlayers.length} orang) berhasil mempertahankan sekolah hingga titik akhir.`;
    }
    // Kondisi 3: KRU SELESAIKAN SEMUA SOAL
    else {
      const anySoloWinner = survivingCrewPlayers.some(c => c.doneTasks >= config.tasksToWin);
      const completedTasksCount = survivingCrewPlayers.reduce((acc, c) => acc + c.doneTasks, 0);

      if (anySoloWinner || completedTasksCount >= (totalCrewPlayers.length * (config.tasksToWin - 1))) {
        winnerTeam = 'crew';
        winnerTitle = '🏆 TIM DETEKTIF / KRU MENANG!';
        reason = `Misi tugas sekolah selesai! Detektif kru berhasil mengaktifkan alarm keamanan. Kru yang tersisa: ${survivingCrewPlayers.length} siswa selamat dari ancaman penyusup.`;
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

    // Online Mode setup
    if (onlineRoom && initialOnlinePlayers && initialOnlinePlayers.length > 0) {
      g.stations = (initialStations && initialStations.length > 0)
        ? initialStations
        : (initialOnlinePlayers.length >= 6 ? SP12 : SP6).map((p, i) => ({
            i,
            x: p[0],
            y: p[1],
            roomIndex: getRoomAt(p[0], p[1])
          }));

      g.players = initialOnlinePlayers.map(p => {
        const isMe = p.id === myPlayerId || p.isMe;
        return {
          ...p,
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
      const stationSpots = isSpectator ? SP12 : SP6;
      g.stations = stationSpots.map((p, i) => ({
        i,
        x: p[0],
        y: p[1],
        roomIndex: getRoomAt(p[0], p[1])
      }));

      const crewCount = isSpectator ? 6 : 4;
      setTotalCrew(crewCount);
      setSurvivingCrew(crewCount);
      setSurvivingImps(config.impostorsCount);

      const crew: Player[] = Array.from({ length: crewCount }, (_, i) => {
        const isMe = !isSpectator && i === 0;
        return {
          id: `crew-${i}`,
          name: isMe ? (playerName || 'Kamu') : BOT_CREW_NAMES[i % BOT_CREW_NAMES.length],
          playerClass: isMe ? playerClass : BOT_CLASSES[i % BOT_CLASSES.length],
          role: 'crew',
          color: CREW_COLORS[i % CREW_COLORS.length],
          x: CP[i % CP.length][0],
          y: CP[i % CP.length][1],
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

      const imps: Player[] = Array.from({ length: config.impostorsCount }, (_, i) => ({
        id: `imp-${i}`,
        name: BOT_IMP_NAMES[i % BOT_IMP_NAMES.length],
        playerClass: 'Penyusup',
        role: 'impostor',
        color: '#e0463c',
        x: IP[i % IP.length][0],
        y: IP[i % IP.length][1],
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
      }));

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
      if (type === 'player_moved') {
        const p = g.players.find(x => x.id === payload.playerId);
        if (p && !p.isMe) {
          p.x = payload.x;
          p.y = payload.y;
          p.dir = payload.dir;
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

    // HTTP Background Polling Fallback (runs every 100ms when online)
    let syncInterval: any = null;
    if (onlineRoom) {
      syncInterval = setInterval(async () => {
        if (g.over) return;
        try {
          const data = await api.syncRoom(onlineRoom.code, lastEventIdRef.current);
          if (data.lastEventId) lastEventIdRef.current = data.lastEventId;

          if (Array.isArray(data.players)) {
            data.players.forEach(remote => {
              const local = g.players.find(p => p.id === remote.id);
              if (local && !local.isMe) {
                local.x = remote.x;
                local.y = remote.y;
                local.dir = remote.dir;
                local.hp = remote.hp;
                local.dead = remote.dead;
                local.doneTasks = remote.doneTasks;
                local.correctAnswers = remote.correctAnswers;
                local.shieldEndTime = remote.shieldEndTime;
                local.workUntil = remote.workUntil;
              }
            });
          }

          if (Array.isArray(data.events)) {
            data.events.forEach(ev => {
              processGameEvent(ev.type, ev.payload);
            });
          }

          if (data.summary && !g.over) {
            processGameEvent('game_over', { summary: data.summary });
          }
        } catch {}
      }, 100);
    }

    // Keyboard handlers
    const keyMap: Record<string, string> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', a: 'left', s: 'down', d: 'right',
      W: 'up', A: 'left', S: 'down', D: 'right'
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (keyMap[e.key]) {
        g.keys[keyMap[e.key]] = true;
      }
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        if (!activeQuiz) {
          interactTask();
        }
      }
      if (e.key === 'q' || e.key === 'Q' || e.key === 'f' || e.key === 'F') {
        if (g.myPlayer) {
          triggerSkill(g.myPlayer);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keyMap[e.key]) {
        g.keys[keyMap[e.key]] = false;
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
              let dx = (g.keys.right ? 1 : 0) - (g.keys.left ? 1 : 0);
              let dy = (g.keys.down ? 1 : 0) - (g.keys.up ? 1 : 0);
              if (dx !== 0 || dy !== 0) {
                const len = Math.hypot(dx, dy);
                if (dx !== 0) c.dir = dx > 0 ? 1 : -1;
                const speed = getSpeed(c);
                moveEntity(c, (dx / len) * speed * dt, (dy / len) * speed * dt);
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
            }
          } else if (imp.isMe) {
            let dx = (g.keys.right ? 1 : 0) - (g.keys.left ? 1 : 0);
            let dy = (g.keys.down ? 1 : 0) - (g.keys.up ? 1 : 0);
            if (dx !== 0 || dy !== 0) {
              const len = Math.hypot(dx, dy);
              if (dx !== 0) imp.dir = dx > 0 ? 1 : -1;
              imp.angle = Math.atan2(dy, dx);
              const speed = getSpeed(imp);
              moveEntity(imp, (dx / len) * speed * dt, (dy / len) * speed * dt);
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

        // 4. Throttled Position Broadcast (20Hz)
        if (onlineRoom && g.myPlayer && !g.myPlayer.dead) {
          const nowMs = performance.now();
          if (nowMs - g.lastNetSyncTime > 50) {
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
      if (syncInterval) clearInterval(syncInterval);
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

  // Furniture Helper
  const drawFurniture = (ctx: CanvasRenderingContext2D, roomIdx: number, rx: number, ry: number) => {
    ctx.save();
    ctx.translate(rx, ry);
    ctx.scale(S, S);

    const R = (c: string, a: number, b: number, w: number, h: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(a, b, w, h);
    };
    const C = (c: string, a: number, b: number, r: number) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(a, b, r, 0, Math.PI * 2);
      ctx.fill();
    };

    if (roomIdx === 0) { // Perpustakaan
      [30, 250].forEach(a => {
        R("#6b4a2b", a, 52, 120, 34);
        for (let k = 0; k < 10; k++) {
          R(["#c0504d", "#4f81bd", "#9bbb59", "#f5d547"][k % 4], a + 6 + k * 11, 58, 8, 22);
        }
      });
      [[45, 285], [265, 285]].forEach(p => {
        R("#8a5d34", p[0], p[1], 90, 44);
        R("#a67545", p[0], p[1], 90, 6);
        C("#5b3a1e", p[0] + 20, p[1] + 58, 8);
        C("#5b3a1e", p[0] + 70, p[1] + 58, 8);
      });
      R("#7a3b3b", 160, 330, 80, 40);
    } else if (roomIdx === 1) { // Laboratorium
      [30, 250].forEach(a => {
        R("#cfd8dc", a, 52, 120, 34);
        R("#90a4ae", a, 80, 120, 6);
        C("#e46a6a", a + 25, 50, 8);
        C("#6ad1e4", a + 60, 50, 8);
        C("#9be46a", a + 95, 50, 8);
      });
      [[40, 290], [270, 290]].forEach(p => {
        R("#cfd8dc", p[0], p[1], 90, 36);
        R("#90a4ae", p[0], p[1] + 32, 90, 6);
        R("#37474f", p[0] + 15, p[1] - 12, 14, 14);
        R("#37474f", p[0] + 55, p[1] - 12, 14, 14);
      });
    } else if (roomIdx === 2) { // Kantin
      R("#8a5d34", 40, 50, 320, 36);
      R("#c28d55", 40, 50, 320, 8);
      for (let k = 0; k < 6; k++) {
        C(["#e8a33d", "#c0504d", "#9bbb59"][k % 3], 70 + k * 48, 68, 9);
      }
      [[70, 300], [330, 300], [330, 130], [70, 160]].forEach(p => {
        C("#6b4a2b", p[0], p[1], 26);
        C("#a67545", p[0], p[1], 22);
        [-1, 1].forEach(s => C("#3b3b3b", p[0] + s * 36, p[1], 9));
      });
    } else if (roomIdx === 3) { // Aula
      R("#2b1d3a", 50, 325, 300, 52);
      R("#5e2a52", 50, 325, 40, 52);
      R("#5e2a52", 310, 325, 40, 52);
      R("#8a6a3a", 50, 372, 300, 6);
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 10; k++) {
          R("#7b6aa0", 40 + k * 31, 75 + r * 30, 20, 16);
        }
      }
    } else if (roomIdx === 4) { // Ruang Kelas
      R("#eceff1", 100, 50, 200, 10);
      R("#607d8b", 96, 46, 208, 4);
      R("#8a5d34", 165, 80, 70, 26);
      [60, 130, 250, 320].forEach(a => [285, 335].forEach(b => {
        R("#a67545", a, b, 44, 24);
        R("#6b4a2b", a + 10, b + 26, 24, 8);
      }));
    } else if (roomIdx === 5) { // Taman
      [[60, 80], [340, 90], [70, 330], [340, 330]].forEach(p => {
        R("#5b3a1e", p[0] - 4, p[1] + 8, 8, 22);
        C("#1f5a2a", p[0], p[1], 30);
        C("#2f7a3a", p[0] - 8, p[1] - 8, 20);
      });
      ctx.fillStyle = "#3b78a8";
      ctx.beginPath();
      ctx.ellipse(320, 210, 40, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      R("#8a5d34", 150, 340, 100, 16);
      R("#5b3a1e", 155, 356, 8, 10);
      R("#5b3a1e", 237, 356, 8, 10);
      [[120, 110], [270, 120], [110, 250], [260, 290], [190, 70]].forEach((p, k) => {
        C(["#f08ca8", "#f5d547", "#fff"][k % 3], p[0], p[1], 5);
      });
    }

    ctx.restore();
  };

  const handleDpadDown = (key: string) => {
    gameRef.current.keys[key] = true;
  };
  const handleDpadUp = (key: string) => {
    gameRef.current.keys[key] = false;
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

        {/* Action Prompt */}
        {canInteractTask && !activeQuiz && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#f5d547] text-[#14261f] font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-bounce cursor-pointer" onClick={interactTask}>
            <span>Tekan [E] atau [Spasi] untuk Kerjakan Tugas</span>
          </div>
        )}
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
          Gerak: <strong>WASD</strong> atau <strong>Panah</strong> · Kerjakan Soal: <strong>E</strong> / <strong>Spasi</strong> · Skill Tameng / Tembak: <strong>Q</strong>
        </div>

        {/* Mobile D-Pad */}
        <div className="flex sm:hidden items-center justify-between w-full px-2 py-1">
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32 select-none">
            <div></div>
            <button
              onPointerDown={() => handleDpadDown('up')}
              onPointerUp={() => handleDpadUp('up')}
              className="bg-[#1d3a2f] border border-[#335a49] rounded-lg flex items-center justify-center text-lg active:bg-[#f5d547] active:text-[#14261f]"
            >
              ▲
            </button>
            <div></div>
            <button
              onPointerDown={() => handleDpadDown('left')}
              onPointerUp={() => handleDpadUp('left')}
              className="bg-[#1d3a2f] border border-[#335a49] rounded-lg flex items-center justify-center text-lg active:bg-[#f5d547] active:text-[#14261f]"
            >
              ◀
            </button>
            <div></div>
            <button
              onPointerDown={() => handleDpadDown('right')}
              onPointerUp={() => handleDpadUp('right')}
              className="bg-[#1d3a2f] border border-[#335a49] rounded-lg flex items-center justify-center text-lg active:bg-[#f5d547] active:text-[#14261f]"
            >
              ▶
            </button>
            <div></div>
            <button
              onPointerDown={() => handleDpadDown('down')}
              onPointerUp={() => handleDpadUp('down')}
              className="bg-[#1d3a2f] border border-[#335a49] rounded-lg flex items-center justify-center text-lg active:bg-[#f5d547] active:text-[#14261f]"
            >
              ▼
            </button>
            <div></div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => gameRef.current.myPlayer && triggerSkill(gameRef.current.myPlayer)}
              className="w-16 h-16 rounded-full bg-[#2b6f8f] border-2 border-[#7fdcff] text-[#f3efdc] font-bold text-xs flex flex-col items-center justify-center shadow active:scale-95"
            >
              <Shield className="w-4 h-4 mb-0.5" />
              {isImpostor ? 'Tembak' : 'Tameng'}
            </button>

            <button
              onClick={interactTask}
              disabled={!canInteractTask}
              className={`w-16 h-16 rounded-full font-bold text-xs flex flex-col items-center justify-center shadow active:scale-95 ${
                canInteractTask ? 'bg-[#f5d547] text-[#14261f]' : 'bg-[#1d3a2f] text-[#a9bdb2] opacity-40'
              }`}
            >
              <Zap className="w-4 h-4 mb-0.5" />
              Tugas
            </button>
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
