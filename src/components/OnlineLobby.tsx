import React, { useState, useEffect } from 'react';
import { GameConfig, Question, Player, OnlineRoomData } from '../types/game';
import { 
  Users, 
  Plus, 
  LogIn, 
  ArrowLeft, 
  Play, 
  Copy, 
  Check, 
  RefreshCw, 
  MessageSquare, 
  Send, 
  GraduationCap, 
  ShieldAlert, 
  Eye, 
  Sparkles,
  HelpCircle,
  Bot
} from 'lucide-react';
import { sounds } from '../utils/sound';
import { api } from '../utils/network';

interface Props {
  ws: WebSocket | null;
  onlineRoom: OnlineRoomData | null;
  roomPlayers: Player[];
  myPlayer: Player | null;
  defaultName: string;
  defaultClass: string;
  questions: Question[];
  config: GameConfig;
  onJoinRoom: (roomCode: string, name: string, playerClass: string, isSpectator: boolean) => void;
  onCreateRoom: (customCode: string, name: string, playerClass: string, config: GameConfig, questions: Question[], isSpectator: boolean) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onBackToMenu: () => void;
  chatMessages: Array<{ senderName: string; senderClass?: string; senderColor: string; text: string; time: string }>;
  onSendChat: (text: string) => void;
}

export const OnlineLobby: React.FC<Props> = ({
  ws,
  onlineRoom,
  roomPlayers,
  myPlayer,
  defaultName,
  defaultClass,
  questions,
  config,
  onJoinRoom,
  onCreateRoom,
  onStartGame,
  onLeaveRoom,
  onBackToMenu,
  chatMessages,
  onSendChat
}) => {
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [nickname, setNickname] = useState(defaultName || '');
  const [playerClass, setPlayerClass] = useState(defaultClass || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Active public rooms from server
  const [availableRooms, setAvailableRooms] = useState<Array<{
    code: string;
    hostName: string;
    playerCount: number;
    status: string;
  }>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Host configuration state
  const [hostConfig, setHostConfig] = useState<GameConfig>(config);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/rooms', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setAvailableRooms(data.rooms);
        }
      }
    } catch (e) {
      console.error('Error fetching rooms', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (!onlineRoom) {
      fetchRooms();
      const interval = setInterval(fetchRooms, 5000);
      return () => clearInterval(interval);
    }
  }, [onlineRoom]);

  const handleCopyCode = () => {
    if (!onlineRoom) return;
    navigator.clipboard.writeText(onlineRoom.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    sounds.playClick();
    setIsCreatingRoom(true);
    onCreateRoom(
      customRoomCode.trim().toUpperCase(),
      nickname.trim(),
      playerClass.trim() || 'Umum',
      hostConfig,
      questions,
      isSpectator
    );
    setTimeout(() => setIsCreatingRoom(false), 3000);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomCodeInput.trim()) return;
    sounds.playClick();
    onJoinRoom(
      roomCodeInput.trim().toUpperCase(),
      nickname.trim(),
      playerClass.trim() || 'Umum',
      isSpectator
    );
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  const handleAddBot = async () => {
    if (!onlineRoom) return;
    sounds.playClick();
    try {
      await api.sendAction(onlineRoom.code, 'add_bot', {});
    } catch (e) {
      console.error('Failed to add bot', e);
    }
  };

  const handleAutoFillBots = async () => {
    if (!onlineRoom) return;
    sounds.playClick();
    try {
      for (let i = roomPlayers.length; i < 6; i++) {
        await api.sendAction(onlineRoom.code, 'add_bot', {});
      }
    } catch (e) {
      console.error('Failed to auto-fill bots', e);
    }
  };

  const handleClearBots = async () => {
    if (!onlineRoom) return;
    sounds.playClick();
    try {
      await api.sendAction(onlineRoom.code, 'clear_bots', {});
    } catch (e) {
      console.error('Failed to clear bots', e);
    }
  };

  const isHost = myPlayer?.isHost || onlineRoom?.hostId === myPlayer?.id;
  const activePlayers = roomPlayers.filter(p => !p.isSpectator);

  return (
    <div className="max-w-4xl mx-auto w-full p-3 sm:p-6 text-[#f3efdc]">
      
      {/* Jika Belum Masuk Room */}
      {!onlineRoom ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#335a49] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#f5d547] flex items-center gap-2">
                  <Users className="w-7 h-7" />
                  Mode Multiplayer Online
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#14261f] text-[#6fd08c] border border-[#335a49]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6fd08c] animate-pulse"></span>
                  Server Multiplayer Aktif
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#a9bdb2] mt-1">
                Masuk sebagai siswa dengan Nickname dan Kelas untuk bermain bersama secara langsung.
              </p>
            </div>

            <button
              onClick={onBackToMenu}
              className="px-3.5 py-2 rounded-xl bg-[#1d3a2f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
          </div>

          {/* Form Identitas Siswa: Nickname & Kelas */}
          <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-base text-[#f5d547] flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Identitas Siswa / Pemain
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                  Nama Panggilan (Nickname) *
                </label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Contoh: Budi, Rani, Dimas"
                  maxLength={16}
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#f5d547]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                  Kelas Siswa *
                </label>
                <input
                  type="text"
                  required
                  value={playerClass}
                  onChange={(e) => setPlayerClass(e.target.value)}
                  placeholder="Contoh: 7A, 8-B, Kelas 9, dsb."
                  maxLength={16}
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#f5d547]"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#a9bdb2]">
              <input
                type="checkbox"
                checked={isSpectator}
                onChange={(e) => setIsSpectator(e.target.checked)}
                className="w-4 h-4 accent-[#f5d547] rounded cursor-pointer"
              />
              <span>Masuk sebagai Spektator (hanya menonton, cocok untuk guru / layar proyektor kelas)</span>
            </label>
          </div>

          {/* Tab Pilihan: Gabung Room / Buat Room */}
          <div className="flex items-center gap-2 border-b border-[#335a49] pb-1">
            <button
              onClick={() => setTab('join')}
              className={`px-4 py-2 rounded-xl text-sm font-display font-bold transition-colors flex items-center gap-2 ${
                tab === 'join' 
                  ? 'bg-[#f5d547] text-[#14261f] shadow' 
                  : 'text-[#a9bdb2] hover:text-[#f3efdc]'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Gabung dengan Kode Room
            </button>

            <button
              onClick={() => setTab('create')}
              className={`px-4 py-2 rounded-xl text-sm font-display font-bold transition-colors flex items-center gap-2 ${
                tab === 'create' 
                  ? 'bg-[#f5d547] text-[#14261f] shadow' 
                  : 'text-[#a9bdb2] hover:text-[#f3efdc]'
              }`}
            >
              <Plus className="w-4 h-4" />
              Buat Room Baru (Guru / Host)
            </button>
          </div>

          {/* TAB 1: Gabung Room */}
          {tab === 'join' && (
            <div className="space-y-6">
              <form onSubmit={handleJoinSubmit} className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                    Masukkan Kode Room
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      placeholder="Ketik kode (misal: DK7A8)"
                      maxLength={12}
                      className="flex-1 bg-[#14261f] border border-[#335a49] rounded-xl px-4 py-2.5 text-base font-mono font-bold tracking-widest text-[#f5d547] focus:outline-none uppercase"
                    />
                    <button
                      type="submit"
                      disabled={!nickname.trim() || !roomCodeInput.trim()}
                      className="px-6 py-2.5 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-sm hover:bg-[#fad85e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow"
                    >
                      Gabung Room
                    </button>
                  </div>
                </div>
              </form>

              {/* Daftar Room Aktif */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-sm text-[#f3efdc] flex items-center gap-2">
                    <span>Room Aktif di Sekolah</span>
                    <button
                      onClick={fetchRooms}
                      className="p-1 rounded-lg hover:bg-[#1d3a2f] text-[#a9bdb2] hover:text-[#f3efdc]"
                      title="Segarkan"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                    </button>
                  </h4>
                  <span className="text-xs text-[#a9bdb2]">
                    {availableRooms.length} room tersedia
                  </span>
                </div>

                {availableRooms.length === 0 ? (
                  <div className="p-6 bg-[#1d3a2f]/60 border border-[#335a49] rounded-2xl text-center text-xs text-[#a9bdb2]">
                    Belum ada room yang aktif. Anda bisa membuat room baru di tab &quot;Buat Room Baru&quot;.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableRooms.map((r) => (
                      <div
                        key={r.code}
                        className="p-4 bg-[#1d3a2f] border border-[#335a49] rounded-xl flex items-center justify-between gap-3 hover:border-[#f5d547] transition-all"
                      >
                        <div>
                          <div className="font-mono font-bold text-base text-[#f5d547]">
                            {r.code}
                          </div>
                          <div className="text-xs text-[#a9bdb2]">
                            Host: {r.hostName} · {r.playerCount} siswa
                          </div>
                          <div className="text-[11px] mt-0.5">
                            <span className={r.status === 'playing' ? 'text-[#ef6b5b]' : 'text-[#6fd08c]'}>
                              {r.status === 'playing' ? '● Sedang Bertanding' : '● Menunggu di Lobi'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setRoomCodeInput(r.code);
                            if (nickname.trim()) {
                              onJoinRoom(r.code, nickname.trim(), playerClass.trim() || 'Umum', isSpectator);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#14261f] border border-[#335a49] text-xs font-bold text-[#f5d547] hover:bg-[#f5d547] hover:text-[#14261f] transition-colors"
                        >
                          Masuk
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Buat Room Baru */}
          {tab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                  Kode Room Kustom (Opsional, biarkan kosong untuk acak)
                </label>
                <input
                  type="text"
                  value={customRoomCode}
                  onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: KELAS7A, IPA8B"
                  maxLength={10}
                  className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-4 py-2 text-sm font-mono uppercase text-[#f5d547] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                    Jumlah Penyusup
                  </label>
                  <select
                    value={hostConfig.impostorsCount}
                    onChange={(e) => setHostConfig(prev => ({ ...prev, impostorsCount: parseInt(e.target.value) }))}
                    className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm text-[#f3efdc] focus:outline-none"
                  >
                    <option value={1}>1 Penyusup</option>
                    <option value={2}>2 Penyusup (Disarankan untuk 6-10 siswa)</option>
                    <option value={3}>3 Penyusup (Grup Besar 10+ siswa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a9bdb2] mb-1">
                    Jumlah Nyawa Detektif Kru
                  </label>
                  <select
                    value={hostConfig.crewLives}
                    onChange={(e) => setHostConfig(prev => ({ ...prev, crewLives: parseInt(e.target.value) }))}
                    className="w-full bg-[#14261f] border border-[#335a49] rounded-xl px-3 py-2 text-sm text-[#f3efdc] focus:outline-none"
                  >
                    <option value={2}>2 Nyawa (Cepat &amp; Menantang)</option>
                    <option value={3}>3 Nyawa (Standar)</option>
                    <option value={5}>5 Nyawa (Lebih Santai)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={!nickname.trim() || isCreatingRoom}
                  className="w-full py-3 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-base hover:bg-[#fad85e] transition-colors shadow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingRoom ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Mempersiapkan Room &amp; Lobi...</span>
                    </>
                  ) : (
                    <span>Buat Room &amp; Buka Lobi Permainan</span>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      ) : (
        /* Jika SUDAH Masuk Room (LOBBY AKTIF) */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header Room & Kode Berbagi */}
          <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#a9bdb2] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#f5d547]" />
                Lobi Pertandingan Online
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-semibold text-[#a9bdb2]">KODE ROOM:</span>
                <span className="font-mono text-2xl sm:text-3xl font-bold text-[#f5d547] tracking-wider">
                  {onlineRoom.code}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-[#f5d547] transition-colors"
                  title="Salin Kode"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-[#6fd08c]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-xs text-[#a9bdb2] mt-1">
                Bagikan kode ini kepada siswa lain agar mereka dapat bergabung.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {isHost && (
                <>
                  <button
                    onClick={handleAddBot}
                    className="px-3 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold text-[#f5d547] flex items-center gap-1 transition-colors"
                    title="Tambah 1 bot siswa latihan"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    + Bot Siswa
                  </button>

                  <button
                    onClick={handleAutoFillBots}
                    className="px-3 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold text-[#6fd08c] flex items-center gap-1 transition-colors hidden sm:flex"
                    title="Isi otomatis sampai 6 pemain"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Isi 6 Siswa
                  </button>

                  {roomPlayers.some(p => p.isAI) && (
                    <button
                      onClick={handleClearBots}
                      className="px-2.5 py-2 rounded-xl bg-[#14261f] border border-[#ef6b5b]/30 hover:bg-[#ef6b5b]/20 text-xs font-semibold text-[#ef6b5b] transition-colors"
                      title="Keluarkan semua bot latihan"
                    >
                      Hapus Bot
                    </button>
                  )}
                </>
              )}

              <button
                onClick={onLeaveRoom}
                className="px-3.5 py-2 rounded-xl bg-[#14261f] border border-[#335a49] hover:bg-[#25493b] text-xs font-semibold text-[#ef6b5b] transition-colors"
              >
                Keluar
              </button>

              {isHost && (
                <button
                  onClick={onStartGame}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#f5d547] text-[#14261f] font-display font-bold text-sm hover:bg-[#fad85e] hover:scale-105 active:scale-95 transition-all shadow flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {activePlayers.length < 2 ? 'Mulai (+Isi Bot Otomatis)' : 'Mulai Pertandingan'}
                </button>
              )}
            </div>
          </div>

          {/* Grid: Daftar Siswa & Obrolan Lobi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Kolom 1 & 2: Daftar Siswa yang Sudah Bergabung */}
            <div className="md:col-span-2 bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#335a49] pb-3">
                <h3 className="font-display font-bold text-base text-[#f5d547] flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Siswa di Room ({roomPlayers.length})
                </h3>
                <span className="text-xs text-[#a9bdb2]">
                  {activePlayers.length} Pemain Aktif {roomPlayers.some(p => p.isSpectator) ? `· ${roomPlayers.filter(p => p.isSpectator).length} Spektator` : ''}
                </span>
              </div>

              {activePlayers.length < 2 && (
                <div className="p-3 bg-[#f5d547]/10 border border-[#f5d547]/30 rounded-xl text-xs text-[#f5d547] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Anda bisa mengajak teman bergabung dengan kode di atas, atau klik <strong>+ Bot Siswa</strong> untuk langsung menguji permainan.</span>
                  </div>
                  <button
                    onClick={handleAddBot}
                    className="px-2.5 py-1 rounded-lg bg-[#f5d547] text-[#14261f] font-bold text-xs shrink-0"
                  >
                    + Tambah Bot
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {roomPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="p-3 bg-[#14261f] border border-[#335a49] rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full border border-black/30 shrink-0"
                        style={{ backgroundColor: player.color }}
                      />
                      <div className="truncate">
                        <div className="font-semibold text-xs sm:text-sm text-[#f3efdc] truncate flex items-center gap-1">
                          <span>{player.name}</span>
                          {player.id === myPlayer?.id && (
                            <span className="text-[10px] bg-[#f5d547] text-[#14261f] font-bold px-1.5 py-0.2 rounded">
                              Kamu
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#a9bdb2]">
                          Kelas: <strong className="text-[#f3efdc]">{player.playerClass || '-'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {player.isHost ? (
                        <span className="text-[10px] bg-[#335a49] text-[#f5d547] font-bold px-2 py-0.5 rounded">
                          Host / Guru
                        </span>
                      ) : player.isSpectator ? (
                        <span className="text-[10px] bg-[#1d3a2f] text-[#7fdcff] px-2 py-0.5 rounded flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Spektator
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#6fd08c] font-medium">
                          Siap Bermain
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kolom 3: Obrolan Siswa di Lobi */}
            <div className="bg-[#1d3a2f] border border-[#335a49] rounded-2xl p-4 flex flex-col h-80">
              <div className="flex items-center gap-2 border-b border-[#335a49] pb-2.5 mb-2 text-xs font-bold text-[#f5d547]">
                <MessageSquare className="w-4 h-4" />
                Obrolan Lobi Kelas
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 text-xs pr-1">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-[#a9bdb2]/60 pt-10 text-[11px]">
                    Belum ada pesan. Sapa teman-teman sekelasmu!
                  </div>
                ) : (
                  chatMessages.map((c, i) => (
                    <div key={i} className="p-2 rounded-lg bg-[#14261f] border border-[#335a49]/60">
                      <div className="flex items-center justify-between text-[10px] text-[#a9bdb2] mb-0.5">
                        <span className="font-semibold" style={{ color: c.senderColor || '#f5d547' }}>
                          {c.senderName} {c.senderClass && `(${c.senderClass})`}
                        </span>
                        <span>{c.time}</span>
                      </div>
                      <div className="text-[#f3efdc] break-words">
                        {c.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="mt-2 flex gap-1.5 pt-2 border-t border-[#335a49]">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ketik pesan..."
                  maxLength={70}
                  className="flex-1 bg-[#14261f] border border-[#335a49] rounded-lg px-2.5 py-1.5 text-xs text-[#f3efdc] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-lg bg-[#f5d547] text-[#14261f] hover:bg-[#fad85e] transition-colors disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
