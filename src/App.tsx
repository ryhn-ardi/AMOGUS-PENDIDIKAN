import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameConfig, Question, MatchSummary, Player, OnlineRoomData, TaskStation } from './types/game';
import { DEFAULT_QUESTIONS } from './data/defaultQuestions';
import { GameScreen } from './components/GameScreen';
import { QuestionEditor } from './components/QuestionEditor';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OnlineLobby } from './components/OnlineLobby';
import { AdminLoginModal } from './components/AdminLoginModal';
import { getMatchHistory } from './utils/leaderboard';
import { api, getClientId } from './utils/network';
import { firebaseMultiplayer } from './utils/firebaseMultiplayer';
import { 
  Play, 
  Users, 
  Eye, 
  BookOpen, 
  Trophy, 
  Shield, 
  Skull, 
  Volume2, 
  VolumeX, 
  User, 
  GraduationCap, 
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Lock
} from 'lucide-react';
import { sounds } from './utils/sound';

export default function App() {
  const [view, setView] = useState<'menu' | 'online_lobby' | 'game' | 'editor'>('menu');
  const [isSpectator, setIsSpectator] = useState<boolean>(false);
  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(false);
  
  // Student Identity: Nickname, Kelas & Nomor Absen
  const [playerName, setPlayerName] = useState<string>('Budi');
  const [playerClass, setPlayerClass] = useState<string>('7A');
  const [attendanceNumber, setAttendanceNumber] = useState<string>('01');

  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);

  // Match Summary & Leaderboard State
  const [lastMatchSummary, setLastMatchSummary] = useState<MatchSummary | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  // Online Multiplayer State & Connection Resilience
  const wsRef = useRef<WebSocket | null>(null);
  const lastEventIdRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomData | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const onlineRoomRef = useRef<OnlineRoomData | null>(onlineRoom);
  const myPlayerRef = useRef<Player | null>(myPlayer);

  useEffect(() => {
    onlineRoomRef.current = onlineRoom;
  }, [onlineRoom]);

  useEffect(() => {
    myPlayerRef.current = myPlayer;
  }, [myPlayer]);
  const [initialOnlineStations, setInitialOnlineStations] = useState<TaskStation[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ senderName: string; senderClass?: string; senderColor: string; text: string; time: string }>>([]);
  const [onlineError, setOnlineError] = useState<string>('');

  // Game Configuration
  const [config, setConfig] = useState<GameConfig>({
    impostorsCount: 2,
    crewLives: 3,
    shieldDuration: 3,
    shieldCooldown: 12,
    impostorShotCooldown: 4,
    speedBoostPerTask: 12,
    tasksToWin: 6
  });

  // Question Bank
  const [questions, setQuestions] = useState<Question[]>(() => {
    try {
      const stored = localStorage.getItem('dk_q_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_QUESTIONS;
  });

  const showOnlineError = useCallback((err: any) => {
    let msg = 'Gagal memproses permintaan online.';
    if (typeof err === 'string') {
      msg = err;
    } else if (err?.message && typeof err.message === 'string') {
      if (err.message.includes('[object Object]') || err.message.includes('Unexpected token')) {
        msg = 'Koneksi ke room tidak valid atau telah berakhir. Silakan pilih room aktif di bawah atau buat room baru.';
      } else {
        msg = err.message;
      }
    } else if (err?.error && typeof err.error === 'string') {
      msg = err.error;
    }
    setOnlineError(msg);
    setTimeout(() => setOnlineError(''), 5000);
  }, []);

  // Check Server Health (Ensures status shows "Server Online" reliably)
  useEffect(() => {
    let isMounted = true;
    let consecutiveFailures = 0;
    const check = async () => {
      const ok = await api.checkHealth();
      if (!isMounted) return;
      if (ok) {
        consecutiveFailures = 0;
        setServerOnline(true);
      } else {
        consecutiveFailures++;
        if (consecutiveFailures >= 8) {
          setServerOnline(false);
        }
      }
    };
    check();
    const interval = setInterval(check, 7000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // WebSocket Connection Management (With aggressive auto-reconnect & session recovery)
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setServerOnline(true);
        reconnectAttemptsRef.current = 0;
        setIsReconnecting(false);

        // Re-register active session on WebSocket server immediately
        if (onlineRoomRef.current && myPlayerRef.current) {
          ws.send(JSON.stringify({
            type: 'reconnect_player',
            roomCode: onlineRoomRef.current.code,
            playerId: myPlayerRef.current.id
          }));
        }
      };

      ws.onclose = () => {
        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        if (onlineRoomRef.current) {
          setIsReconnecting(true);
        }

        // Fast aggressive exponential backoff: 300ms -> 600ms -> 1.1s -> 2.2s -> 4s
        const backoff = Math.min(4000, Math.floor(250 * Math.pow(1.4, Math.min(attempt, 8)) + Math.random() * 200));
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, backoff);
      };

      ws.onerror = () => {
        if (onlineRoomRef.current) setIsReconnecting(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'reconnected') {
            setIsReconnecting(false);
            if (msg.room) setOnlineRoom(msg.room);
            if (msg.players) setRoomPlayers(msg.players);
            if (msg.myPlayer) setMyPlayer(msg.myPlayer);
          } else if (msg.type === 'room_created' || msg.type === 'room_joined') {
            setOnlineRoom(msg.room);
            setRoomPlayers(msg.players || []);
            setMyPlayer(msg.myPlayer || null);
            setOnlineError('');
            setView('online_lobby');
          } else if (msg.type === 'player_joined') {
            setRoomPlayers(msg.players || []);
            if (msg.message) sounds.playClick();
          } else if (msg.type === 'player_left') {
            setRoomPlayers(msg.players || []);
          } else if (msg.type === 'game_started') {
            setOnlineRoom(msg.room);
            setRoomPlayers(msg.players || []);
            setInitialOnlineStations(msg.stations || []);
            setIsOnlineMode(true);
            setView('game');
          } else if (msg.type === 'chat_broadcast') {
            setChatMessages(prev => [...prev.slice(-30), msg]);
          } else if (msg.type === 'game_over') {
            if (msg.summary) {
              setLastMatchSummary(msg.summary);
              setShowLeaderboard(true);
            }
          } else if (msg.type === 'returned_to_lobby') {
            setOnlineRoom(msg.room);
            setRoomPlayers(msg.players || []);
            setShowLeaderboard(false);
            setView('online_lobby');
          } else if (msg.type === 'error') {
            showOnlineError(msg.message || 'Terjadi kesalahan di server.');
          }
        } catch (e) {
          console.error('Error in ws message', e);
        }
      };
    } catch {
      // Handled silently by fallback
    }
  }, [showOnlineError]);

  // Session & Network Recovery Handler
  useEffect(() => {
    connectWebSocket();

    const restoreSession = async () => {
      try {
        const saved = sessionStorage.getItem('dk_active_session');
        if (saved && !onlineRoomRef.current) {
          const sess = JSON.parse(saved);
          if (sess && sess.code) {
            const res = await api.joinRoom({
              roomCode: sess.code,
              name: sess.name || playerName,
              playerClass: sess.playerClass || playerClass,
              attendanceNumber: sess.attendanceNumber || attendanceNumber,
              isSpectator: sess.isSpectator
            });
            setOnlineRoom(res.room);
            setRoomPlayers(res.players || []);
            setMyPlayer(res.myPlayer || null);
            setIsOnlineMode(true);
            if (res.room.status === 'playing') setView('game');
            else setView('online_lobby');
          }
        }
      } catch {}
    };

    restoreSession();

    const handleOnline = () => {
      setIsReconnecting(false);
      setServerOnline(true);
      connectWebSocket();
      restoreSession();
    };

    const handleOffline = () => {
      setIsReconnecting(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    try {
      const savedConfig = localStorage.getItem('dk_cf_v2');
      if (savedConfig) setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
      const savedName = localStorage.getItem('dk_player_name');
      if (savedName) setPlayerName(savedName);
      const savedClass = localStorage.getItem('dk_player_class');
      if (savedClass) setPlayerClass(savedClass);
      const savedAbsen = localStorage.getItem('dk_player_absen');
      if (savedAbsen) setAttendanceNumber(savedAbsen);
    } catch {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket, playerName, playerClass, attendanceNumber]);

  // Real-time Firebase Synchronization for Lobby and Room
  useEffect(() => {
    if (!onlineRoom) return;

    // 1. Subscribe to Room document (status changes, stations, etc.)
    const unsubRoom = firebaseMultiplayer.subscribeRoom(onlineRoom.code, (updatedRoom) => {
      if (!updatedRoom) {
        setOnlineRoom(null);
        setView('menu');
        return;
      }
      setOnlineRoom(updatedRoom);

      if (updatedRoom.status === 'playing' && view !== 'game') {
        if ((updatedRoom as any).stations) {
          setInitialOnlineStations((updatedRoom as any).stations);
        }
        setIsOnlineMode(true);
        setView('game');
      } else if (updatedRoom.status === 'lobby' && view === 'game') {
        setView('online_lobby');
      }
    });

    // 2. Subscribe to Players in the Room (live joins, leaves, role updates)
    const currentClientId = getClientId();
    const unsubPlayers = firebaseMultiplayer.subscribePlayers(onlineRoom.code, currentClientId, (players) => {
      setRoomPlayers(players);
      const me = players.find(p => p.id === currentClientId);
      if (me) setMyPlayer(me);
    });

    // 3. Subscribe to Real-time Events (chats, bullet triggers, announcements)
    const unsubEvents = firebaseMultiplayer.subscribeEvents(onlineRoom.code, (event) => {
      if (event.type === 'chat_message') {
        setChatMessages(prev => [
          ...prev.slice(-30),
          {
            senderName: event.payload.name || 'Siswa',
            senderClass: event.payload.playerClass || '',
            senderColor: event.payload.color || '#f5d547',
            text: event.payload.text || '',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else if (event.type === 'game_started') {
        setIsOnlineMode(true);
        setView('game');
      } else if (event.type === 'returned_to_lobby') {
        setShowLeaderboard(false);
        setView('online_lobby');
      }
    });

    return () => {
      unsubRoom();
      unsubPlayers();
      unsubEvents();
    };
  }, [onlineRoom?.code, view]);

  const handleSaveQuestions = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    try {
      localStorage.setItem('dk_q_v2', JSON.stringify(newQuestions));
    } catch {}
  };

  const handleNameChange = (name: string) => {
    const clean = name.slice(0, 16);
    setPlayerName(clean);
    try {
      localStorage.setItem('dk_player_name', clean);
    } catch {}
  };

  const handleClassChange = (cls: string) => {
    const clean = cls.slice(0, 16);
    setPlayerClass(clean);
    try {
      localStorage.setItem('dk_player_class', clean);
    } catch {}
  };

  const handleAttendanceChange = (absen: string) => {
    const clean = absen.slice(0, 6);
    setAttendanceNumber(clean);
    try {
      localStorage.setItem('dk_player_absen', clean);
    } catch {}
  };

  // Online Room Handlers (Full REST API + WebSocket Sync)
  const handleCreateRoom = async (
    customCode: string,
    name: string,
    cls: string,
    absen: string,
    hostConfig: GameConfig,
    qs: Question[],
    spectator: boolean
  ) => {
    handleNameChange(name);
    handleClassChange(cls);
    handleAttendanceChange(absen);
    try {
      const data = await api.createRoom({
        roomCode: customCode,
        name,
        playerClass: cls,
        attendanceNumber: absen,
        config: hostConfig,
        questions: qs,
        isSpectator: spectator
      });
      setOnlineRoom(data.room);
      setRoomPlayers(data.players || []);
      setMyPlayer(data.myPlayer || null);
      lastEventIdRef.current = data.lastEventId || 0;
      setOnlineError('');
      setView('online_lobby');
      try {
        sessionStorage.setItem('dk_active_session', JSON.stringify({
          code: data.room.code,
          name,
          playerClass: cls,
          attendanceNumber: absen,
          isSpectator: spectator
        }));
      } catch {}
    } catch (err: any) {
      showOnlineError(err);
    }
  };

  const handleJoinRoom = async (code: string, name: string, cls: string, absen: string, spectator: boolean) => {
    handleNameChange(name);
    handleClassChange(cls);
    handleAttendanceChange(absen);
    try {
      const data = await api.joinRoom({
        roomCode: code,
        name,
        playerClass: cls,
        attendanceNumber: absen,
        isSpectator: spectator
      });
      setOnlineRoom(data.room);
      setRoomPlayers(data.players || []);
      setMyPlayer(data.myPlayer || null);
      lastEventIdRef.current = data.lastEventId || 0;
      setOnlineError('');
      setView('online_lobby');
      try {
        sessionStorage.setItem('dk_active_session', JSON.stringify({
          code: data.room.code,
          name,
          playerClass: cls,
          attendanceNumber: absen,
          isSpectator: spectator
        }));
      } catch {}
    } catch (err: any) {
      showOnlineError(err);
    }
  };

  const handleStartOnlineGame = async () => {
    if (!onlineRoom) return;
    sounds.playClick();
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'start_game' }));
      }
      await api.sendAction(onlineRoom.code, 'start_game', {});
    } catch (err: any) {
      showOnlineError(err);
    }
  };

  const handleLeaveOnlineRoom = async () => {
    try {
      sessionStorage.removeItem('dk_active_session');
    } catch {}
    if (onlineRoom) {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'leave_room' }));
        }
        await api.sendAction(onlineRoom.code, 'leave_room', {});
      } catch {}
    }
    setOnlineRoom(null);
    setRoomPlayers([]);
    setMyPlayer(null);
    setIsOnlineMode(false);
    setView('menu');
  };

  const handleSendChat = async (text: string) => {
    if (!onlineRoom) return;
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'chat_message', text }));
      }
      await api.sendAction(onlineRoom.code, 'chat_message', { text });
    } catch {}
  };

  // Solo & Offline Fallbacks
  const startSoloGame = () => {
    sounds.playClick();
    setIsOnlineMode(false);
    setIsSpectator(false);
    setView('game');
  };

  const startSpectatorSolo = () => {
    sounds.playClick();
    setIsOnlineMode(false);
    setIsSpectator(true);
    setView('game');
  };

  const handleGameOver = (summary: MatchSummary) => {
    setLastMatchSummary(summary);
    setShowLeaderboard(true);
  };

  const openGlobalLeaderboard = () => {
    sounds.playClick();
    const history = getMatchHistory();
    if (history.length > 0) {
      setLastMatchSummary(history[0]);
    } else {
      setLastMatchSummary({
        id: 'initial',
        date: 'Baru saja',
        winnerTeam: 'crew',
        winnerTitle: '🏆 TIM DETEKTIF / KRU MENANG!',
        reason: 'Selesaikan pertandingan pertamamu bersama teman sekelas untuk mencatat rekor!',
        survivingCrewCount: 4,
        totalCrewCount: 4,
        survivingImpostorCount: 0,
        totalImpostorCount: 2,
        matchDuration: 120,
        leaderboard: [
          {
            id: 'demo-1',
            name: playerName || 'Kamu',
            playerClass: playerClass || '7A',
            role: 'crew',
            isMe: true,
            color: '#4aa3df',
            scoreTasks: 6,
            totalAttempts: 6,
            accuracy: 100,
            survivalTime: 120,
            survived: true,
            avgSpeed: 2.8,
            compositeScore: 1240,
            rank: 1
          },
          {
            id: 'demo-2',
            name: 'Rani',
            playerClass: '7B',
            role: 'crew',
            isMe: false,
            color: '#e8a33d',
            scoreTasks: 4,
            totalAttempts: 5,
            accuracy: 80,
            survivalTime: 110,
            survived: true,
            avgSpeed: 3.5,
            compositeScore: 890,
            rank: 2
          },
          {
            id: 'demo-3',
            name: 'Penyusup Hitam',
            playerClass: 'Penyusup',
            role: 'impostor',
            isMe: false,
            color: '#e0463c',
            scoreTasks: 0,
            totalAttempts: 0,
            accuracy: 0,
            survivalTime: 95,
            survived: false,
            avgSpeed: 0,
            compositeScore: 240,
            rank: 3
          }
        ]
      });
    }
    setShowLeaderboard(true);
  };

  return (
    <div className="min-h-screen bg-[#14261f] text-[#f3efdc] flex flex-col font-sans select-none">
      
      {/* Top Navbar */}
      <header className="border-b border-[#335a49] bg-[#1d3a2f]/80 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div 
          onClick={() => {
            if (onlineRoom) {
              setView('online_lobby');
            } else {
              setView('menu');
            }
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-xl bg-[#f5d547] text-[#14261f] flex items-center justify-center font-display font-bold text-lg shadow">
            DK
          </div>
          <div>
            <span className="font-display font-bold text-lg sm:text-xl text-[#f5d547] tracking-tight">
              Detektif Kelas
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] text-[#a9bdb2] font-semibold bg-[#14261f] px-2 py-0.5 rounded-full border border-[#335a49]">
              Online Multiplayer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Status Koneksi Online - Aktif & Terverifikasi */}
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[#14261f] border border-[#335a49]">
            {serverOnline ? (
              <span className="flex items-center gap-1.5 text-[#6fd08c] font-medium text-xs">
                <span className="w-2 h-2 rounded-full bg-[#6fd08c] animate-pulse"></span>
                <Wifi className="w-3.5 h-3.5" />
                <span>Server Online</span>
              </span>
            ) : (
              <button
                onClick={async () => {
                  const ok = await api.checkHealth();
                  setServerOnline(ok);
                }}
                className="flex items-center gap-1.5 text-[#f5d547] text-xs hover:text-[#fad85e] transition-colors cursor-pointer"
                title="Klik untuk menyambungkan kembali"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sambungkan Ulang</span>
              </button>
            )}
          </div>

          <button
            onClick={openGlobalLeaderboard}
            className="px-3 py-1.5 rounded-xl bg-[#14261f] border border-[#335a49] text-xs font-semibold text-[#f5d547] hover:bg-[#25493b] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Trophy className="w-3.5 h-3.5 text-[#f5d547]" />
            <span className="hidden sm:inline">Papan Peringkat</span>
            <span className="sm:hidden">Skor</span>
          </button>

          <button
            onClick={() => setSoundOn(sounds.toggleSound())}
            className="p-2 rounded-xl bg-[#14261f] border border-[#335a49] text-[#a9bdb2] hover:text-[#f3efdc] transition-colors"
            title={soundOn ? 'Matikan Suara' : 'Nyalakan Suara'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-[#6fd08c]" /> : <VolumeX className="w-4 h-4 text-[#ef6b5b]" />}
          </button>
        </div>
      </header>

      {/* Auto-reconnect active indicator badge */}
      {isReconnecting && onlineRoom && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#e0463c]/95 border-2 border-white text-white text-xs sm:text-sm font-bold shadow-2xl flex items-center gap-2 animate-bounce backdrop-blur-md">
          <RefreshCw className="w-4 h-4 animate-spin text-[#f5d547]" />
          <span>Sinyal Terputus · Menghubungkan Kembali ke Room ({onlineRoom.code})...</span>
        </div>
      )}

      {/* Pesan Kesalahan Online (jika ada) */}
      {onlineError && (
        <div className="bg-[#ef6b5b] text-[#2b0d08] px-4 py-2.5 text-center text-xs sm:text-sm font-bold shadow animate-in fade-in flex items-center justify-center gap-2">
          <span>{typeof onlineError === 'string' ? onlineError : 'Terjadi kendala koneksi room.'}</span>
          <button 
            onClick={() => setOnlineError('')}
            className="text-xs underline ml-2 opacity-80 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center p-3 sm:p-6 max-w-6xl w-full mx-auto">
        
        {/* VIEW 1: Main Menu */}
        {view === 'menu' && (
          <div className="max-w-2xl mx-auto w-full text-center space-y-6 py-4 animate-in fade-in duration-300">
            
            {/* Title & Badge */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#1d3a2f] border border-[#335a49] text-[#f5d547]">
                <Sparkles className="w-3.5 h-3.5" />
                Game Survival Kuis Tim Sekolah Berbasis Online
              </div>

              <h1 className="text-4xl sm:text-6xl font-display font-bold text-[#f5d547] tracking-tight -rotate-1 drop-shadow-md">
                Detektif Kelas
              </h1>

              <p className="text-sm sm:text-base text-[#a9bdb2] max-w-md mx-auto leading-relaxed">
                Bergabunglah bersama teman sekelas dengan nickname &amp; kelasmu. Selesaikan stasiun soal, bertahankah tim kru, atau penyusup yang akan menang?
              </p>
            </div>

            {/* Identitas Siswa: Nama, Kelas & Nomor Absen */}
            <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-4 max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left shadow-lg">
              <div>
                <label className="block text-[11px] font-semibold text-[#a9bdb2] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#f5d547]" />
                  Nickname
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nama panggilan..."
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm text-[#f3efdc] font-semibold focus:outline-none focus:border-[#f5d547]"
                  maxLength={16}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#a9bdb2] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[#f5d547]" />
                  Kelas
                </label>
                <input
                  type="text"
                  value={playerClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  placeholder="Contoh: 7A, 8B"
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm text-[#f3efdc] font-semibold focus:outline-none focus:border-[#f5d547]"
                  maxLength={16}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#a9bdb2] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#f5d547]" />
                  Nomor Absen
                </label>
                <input
                  type="text"
                  value={attendanceNumber}
                  onChange={(e) => handleAttendanceChange(e.target.value)}
                  placeholder="Contoh: 01, 15"
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm text-[#f3efdc] font-semibold focus:outline-none focus:border-[#f5d547]"
                  maxLength={6}
                />
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  sounds.playClick();
                  setView('online_lobby');
                }}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#f5d547] text-[#14261f] font-display font-bold text-base sm:text-lg hover:bg-[#fad85e] hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 border-2 border-[#14261f]"
              >
                <Users className="w-5 h-5" />
                Masuk Game Online (Multiplayer Kelas)
              </button>

              <button
                onClick={startSoloGame}
                className="px-5 py-3 rounded-2xl bg-[#1d3a2f] text-[#f3efdc] border-2 border-[#335a49] hover:bg-[#25493b] font-display font-bold text-sm sm:text-base transition-all flex items-center gap-2 shadow"
              >
                <Play className="w-4 h-4 text-[#6fd08c] fill-current" />
                Latihan Solo
              </button>

              <button
                onClick={startSpectatorSolo}
                className="px-5 py-3 rounded-2xl bg-[#1d3a2f] text-[#f3efdc] border-2 border-[#335a49] hover:bg-[#25493b] font-display font-bold text-sm sm:text-base transition-all flex items-center gap-2 shadow"
              >
                <Eye className="w-4 h-4 text-[#7fdcff]" />
                Latihan Spektator
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  // Cek apakah admin sudah login dalam sesi ini
                  if (sessionStorage.getItem('dk_admin_auth') === 'true') {
                    setView('editor');
                  } else {
                    setShowAdminLogin(true);
                  }
                }}
                className="px-5 py-3 rounded-2xl bg-[#1d3a2f] text-[#f3efdc] border-2 border-[#335a49] hover:bg-[#25493b] font-display font-bold text-sm sm:text-base transition-all flex items-center gap-2 shadow"
              >
                <Lock className="w-4 h-4 text-[#f5d547]" />
                Bank Soal Guru ({questions.length})
              </button>
            </div>

            {/* Aturan Kemenangan Tim & Leaderboard Ringkas */}
            <div className="pt-4 border-t border-[#335a49]/60 max-w-xl mx-auto text-xs text-[#a9bdb2] leading-relaxed">
              <span className="font-semibold text-[#f5d547]">Logika Penilaian &amp; Kemenangan:</span><br />
              • <strong>Kemenangan Tim</strong>: Dihitung dari siapa tim yang anggotanya bertahan hidup paling akhir.<br />
              • <strong>Leaderboard</strong>: Dinilai berdasarkan skor soal terjawab benar, lama waktu bertahan hidup, serta kecepatan rata-rata saat menjawab kuis.
            </div>

          </div>
        )}

        {/* VIEW 2: Online Lobby (Multiplayer Room) */}
        {view === 'online_lobby' && (
          <OnlineLobby
            ws={wsRef.current}
            onlineRoom={onlineRoom}
            roomPlayers={roomPlayers}
            myPlayer={myPlayer}
            defaultName={playerName}
            defaultClass={playerClass}
            defaultAttendance={attendanceNumber}
            questions={questions}
            config={config}
            onJoinRoom={handleJoinRoom}
            onCreateRoom={handleCreateRoom}
            onStartGame={handleStartOnlineGame}
            onLeaveRoom={handleLeaveOnlineRoom}
            onBackToMenu={() => setView('menu')}
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
          />
        )}

        {/* VIEW 3: In-Game Canvas (Online or Solo) */}
        {view === 'game' && (
          <GameScreen
            questions={questions}
            config={config}
            isSpectator={isSpectator}
            playerName={playerName}
            playerClass={playerClass}
            attendanceNumber={attendanceNumber}
            ws={isOnlineMode ? wsRef.current : null}
            onlineRoom={isOnlineMode ? onlineRoom : null}
            initialOnlinePlayers={isOnlineMode ? roomPlayers : undefined}
            initialStations={isOnlineMode ? initialOnlineStations : undefined}
            myPlayerId={myPlayer?.id || getClientId()}
            onGameOver={handleGameOver}
            onExit={async () => {
              if (isOnlineMode) {
                if (onlineRoom && onlineRoom.hostId === myPlayer?.id) {
                  try {
                    await api.sendAction(onlineRoom.code, 'return_to_lobby', {});
                  } catch {}
                } else {
                  handleLeaveOnlineRoom();
                }
              } else {
                setView('menu');
              }
            }}
          />
        )}

        {/* VIEW 4: Question Editor */}
        {view === 'editor' && (
          <QuestionEditor
            questions={questions}
            onSaveQuestions={handleSaveQuestions}
            onBack={() => setView('menu')}
          />
        )}

      </main>

      {/* Leaderboard Modal Dialog */}
      {showLeaderboard && lastMatchSummary && (
        <LeaderboardModal
          summary={lastMatchSummary}
          onPlayAgain={async () => {
            setShowLeaderboard(false);
            if (isOnlineMode && onlineRoom) {
              if (onlineRoom.hostId === myPlayer?.id) {
                try {
                  await api.sendAction(onlineRoom.code, 'return_to_lobby', {});
                } catch {}
              }
              setView('online_lobby');
            } else {
              setView('game');
            }
          }}
          onBackToMenu={() => {
            setShowLeaderboard(false);
            if (isOnlineMode) {
              handleLeaveOnlineRoom();
            } else {
              setView('menu');
            }
          }}
        />
      )}

      {/* Admin Login Modal Dialog */}
      <AdminLoginModal
        isOpen={showAdminLogin}
        onSuccess={() => {
          setShowAdminLogin(false);
          setView('editor');
        }}
        onClose={() => setShowAdminLogin(false)}
      />

      {/* Footer */}
      <footer className="border-t border-[#335a49]/60 px-4 py-3 text-center text-xs text-[#a9bdb2]">
        Detektif Kelas · Game Survival Kuis Edukasi &amp; Papan Peringkat Kompetitif Berbasis Online
      </footer>

    </div>
  );
}
