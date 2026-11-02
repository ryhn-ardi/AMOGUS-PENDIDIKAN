import React, { useState, useEffect } from 'react';
import { GameConfig, Question, MatchSummary } from './types/game';
import { DEFAULT_QUESTIONS } from './data/defaultQuestions';
import { GameScreen } from './components/GameScreen';
import { QuestionEditor } from './components/QuestionEditor';
import { LeaderboardModal } from './components/LeaderboardModal';
import { getMatchHistory } from './utils/leaderboard';
import { 
  Play, 
  Eye, 
  BookOpen, 
  Trophy, 
  Settings, 
  Shield, 
  Skull, 
  Volume2, 
  VolumeX, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Flame, 
  Sparkles 
} from 'lucide-react';
import { sounds } from './utils/sound';

export default function App() {
  const [view, setView] = useState<'menu' | 'game' | 'editor'>('menu');
  const [isSpectator, setIsSpectator] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('Detektif Kamu');
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [showAdminConfig, setShowAdminConfig] = useState<boolean>(false);

  // Match Summary & Leaderboard State
  const [lastMatchSummary, setLastMatchSummary] = useState<MatchSummary | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

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

  // Load saved configurations on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('dk_cf_v2');
      if (savedConfig) {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
      }
      const savedName = localStorage.getItem('dk_player_name');
      if (savedName) {
        setPlayerName(savedName);
      }
    } catch {}
  }, []);

  const handleSaveQuestions = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    try {
      localStorage.setItem('dk_q_v2', JSON.stringify(newQuestions));
    } catch {}
  };

  const handleUpdateConfig = (key: keyof GameConfig, val: number) => {
    setConfig(prev => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem('dk_cf_v2', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleNameChange = (name: string) => {
    const clean = name.slice(0, 16);
    setPlayerName(clean);
    try {
      localStorage.setItem('dk_player_name', clean);
    } catch {}
  };

  const startSoloGame = () => {
    sounds.playClick();
    setIsSpectator(false);
    setView('game');
  };

  const startSpectatorGame = () => {
    sounds.playClick();
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
      // Mock / initial showcase leaderboard if no games played yet
      setLastMatchSummary({
        id: 'initial',
        date: 'Baru saja',
        winnerTeam: 'crew',
        winnerTitle: '🏆 TIM DETEKTIF / KRU MENANG!',
        reason: 'Selesaikan pertandingan pertamamu untuk mencatat rekor skor dan waktu bertahan!',
        survivingCrewCount: 4,
        totalCrewCount: 4,
        survivingImpostorCount: 0,
        totalImpostorCount: 2,
        matchDuration: 120,
        leaderboard: [
          {
            id: 'demo-1',
            name: playerName || 'Kamu',
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
            name: 'Budi',
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
          onClick={() => setView('menu')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-xl bg-[#f5d547] text-[#14261f] flex items-center justify-center font-display font-bold text-lg shadow">
            DK
          </div>
          <span className="font-display font-bold text-lg sm:text-xl text-[#f5d547] tracking-tight">
            Detektif Kelas
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
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

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center p-3 sm:p-6 max-w-6xl w-full mx-auto">
        
        {/* VIEW 1: Main Menu */}
        {view === 'menu' && (
          <div className="max-w-2xl mx-auto w-full text-center space-y-6 py-6 animate-in fade-in duration-300">
            
            {/* Title & Badge */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#1d3a2f] border border-[#335a49] text-[#f5d547]">
                <Sparkles className="w-3.5 h-3.5" />
                Game Edukasi Survival &amp; Logika Tim
              </div>

              <h1 className="text-4xl sm:text-6xl font-display font-bold text-[#f5d547] tracking-tight -rotate-1 drop-shadow-md">
                Detektif Kelas
              </h1>

              <p className="text-sm sm:text-base text-[#a9bdb2] max-w-md mx-auto leading-relaxed">
                Ada penyusup berkeliaran di sekolah! Kerjakan soal di stasiun tugas, bertahan bersama rekan detektif, dan buktikan siapa yang bertahan paling akhir.
              </p>
            </div>

            {/* Nama Pemain Input */}
            <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl p-4 max-w-md mx-auto flex items-center gap-3">
              <User className="w-5 h-5 text-[#f5d547] shrink-0" />
              <div className="flex-1 text-left">
                <label className="block text-[11px] font-semibold text-[#a9bdb2] uppercase tracking-wider">
                  Nama Detektif
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ketik nama panggilan..."
                  className="w-full bg-transparent text-[#f3efdc] font-semibold text-sm focus:outline-none placeholder:text-[#a9bdb2]/50"
                  maxLength={16}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={startSoloGame}
                className="px-6 py-3.5 rounded-2xl bg-[#f5d547] text-[#14261f] font-display font-bold text-base sm:text-lg hover:bg-[#fad85e] hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                Main Solo Detektif
              </button>

              <button
                onClick={startSpectatorGame}
                className="px-5 py-3 rounded-2xl bg-[#1d3a2f] text-[#f3efdc] border-2 border-[#335a49] hover:bg-[#25493b] font-display font-bold text-sm sm:text-base transition-all flex items-center gap-2 shadow"
              >
                <Eye className="w-4 h-4 text-[#7fdcff]" />
                Latihan Spektator
              </button>

              <button
                onClick={() => setView('editor')}
                className="px-5 py-3 rounded-2xl bg-[#1d3a2f] text-[#f3efdc] border-2 border-[#335a49] hover:bg-[#25493b] font-display font-bold text-sm sm:text-base transition-all flex items-center gap-2 shadow"
              >
                <BookOpen className="w-4 h-4 text-[#6fd08c]" />
                Bank Soal ({questions.length})
              </button>

              <button
                onClick={openGlobalLeaderboard}
                className="px-5 py-3 rounded-2xl bg-[#1d3a2f] text-[#f3efdc] border-2 border-[#335a49] hover:bg-[#25493b] font-display font-bold text-sm sm:text-base transition-all flex items-center gap-2 shadow"
              >
                <Trophy className="w-4 h-4 text-[#f5d547]" />
                Leaderboard
              </button>
            </div>

            {/* Pengaturan Cepat Permainan */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-4 text-xs sm:text-sm text-[#a9bdb2]">
              <label className="flex items-center gap-2 bg-[#1d3a2f] px-3.5 py-2 rounded-xl border border-[#335a49]">
                <Skull className="w-4 h-4 text-[#ef6b5b]" />
                <span>Penyusup:</span>
                <select
                  value={config.impostorsCount}
                  onChange={(e) => handleUpdateConfig('impostorsCount', parseInt(e.target.value))}
                  className="bg-[#14261f] text-[#f3efdc] border border-[#335a49] rounded-lg px-2 py-1 font-semibold focus:outline-none"
                >
                  <option value={1}>1 Penyusup</option>
                  <option value={2}>2 Penyusup (Standar)</option>
                  <option value={3}>3 Penyusup (Sulit)</option>
                </select>
              </label>

              <label className="flex items-center gap-2 bg-[#1d3a2f] px-3.5 py-2 rounded-xl border border-[#335a49]">
                <Shield className="w-4 h-4 text-[#6fd08c]" />
                <span>Nyawa Kru:</span>
                <select
                  value={config.crewLives}
                  onChange={(e) => handleUpdateConfig('crewLives', parseInt(e.target.value))}
                  className="bg-[#14261f] text-[#f3efdc] border border-[#335a49] rounded-lg px-2 py-1 font-semibold focus:outline-none"
                >
                  <option value={2}>2 Nyawa</option>
                  <option value={3}>3 Nyawa</option>
                  <option value={5}>5 Nyawa</option>
                </select>
              </label>
            </div>

            {/* Pengaturan Lanjutan / Admin */}
            <div className="max-w-md mx-auto pt-2">
              <button
                onClick={() => setShowAdminConfig(!showAdminConfig)}
                className="text-xs font-semibold text-[#a9bdb2] hover:text-[#f3efdc] flex items-center justify-center gap-1.5 mx-auto transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Pengaturan Keseimbangan Game</span>
                {showAdminConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdminConfig && (
                <div className="mt-3 p-4 bg-[#1d3a2f] border border-[#335a49] rounded-2xl text-left space-y-3 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[#a9bdb2]">Durasi Tameng (detik):</span>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={config.shieldDuration}
                      onChange={(e) => handleUpdateConfig('shieldDuration', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-[#14261f] border border-[#335a49] rounded-lg px-2 py-1 text-center font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#a9bdb2]">Cooldown Tameng (detik):</span>
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={config.shieldCooldown}
                      onChange={(e) => handleUpdateConfig('shieldCooldown', Math.max(3, parseInt(e.target.value) || 3))}
                      className="w-16 bg-[#14261f] border border-[#335a49] rounded-lg px-2 py-1 text-center font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#a9bdb2]">Jeda Tembakan Penyusup (detik):</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.impostorShotCooldown}
                      onChange={(e) => handleUpdateConfig('impostorShotCooldown', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-[#14261f] border border-[#335a49] rounded-lg px-2 py-1 text-center font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#a9bdb2]">Tambahan Kecepatan per Soal (%):</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={config.speedBoostPerTask}
                      onChange={(e) => handleUpdateConfig('speedBoostPerTask', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 bg-[#14261f] border border-[#335a49] rounded-lg px-2 py-1 text-center font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Aturan Kemenangan Tim & Leaderboard Ringkas */}
            <div className="pt-4 border-t border-[#335a49]/60 max-w-xl mx-auto text-xs text-[#a9bdb2] leading-relaxed">
              <span className="font-semibold text-[#f5d547]">Logika Penilaian &amp; Kemenangan:</span><br />
              • <strong>Kemenangan Tim</strong>: Dihitung dari siapa tim yang anggotanya bertahan hidup paling akhir.<br />
              • <strong>Leaderboard</strong>: Dinilai berdasarkan skor soal terjawab benar, lama waktu bertahan hidup, serta kecepatan rata-rata saat menjawab kuis.
            </div>

          </div>
        )}

        {/* VIEW 2: In-Game Canvas */}
        {view === 'game' && (
          <GameScreen
            questions={questions}
            config={config}
            isSpectator={isSpectator}
            playerName={playerName}
            onGameOver={handleGameOver}
            onExit={() => setView('menu')}
          />
        )}

        {/* VIEW 3: Question Editor */}
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
          onPlayAgain={() => {
            setShowLeaderboard(false);
            setView('game');
          }}
          onBackToMenu={() => {
            setShowLeaderboard(false);
            setView('menu');
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-[#335a49]/60 px-4 py-3 text-center text-xs text-[#a9bdb2]">
        Detektif Kelas · Game Survival Kuis Edukasi &amp; Papan Peringkat Kompetitif
      </footer>

    </div>
  );
}
