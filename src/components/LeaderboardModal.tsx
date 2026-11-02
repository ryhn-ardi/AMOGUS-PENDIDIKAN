import React, { useState } from 'react';
import { MatchSummary, LeaderboardEntry } from '../types/game';
import { sortLeaderboard, formatDuration, getMatchHistory } from '../utils/leaderboard';
import { Trophy, Clock, Zap, CheckCircle2, Shield, Skull, Award, History, RotateCcw, Home } from 'lucide-react';

interface Props {
  summary: MatchSummary;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export const LeaderboardModal: React.FC<Props> = ({ summary, onPlayAgain, onBackToMenu }) => {
  const [activeSort, setActiveSort] = useState<'composite' | 'score' | 'survival' | 'speed'>('composite');
  const [teamFilter, setTeamFilter] = useState<'all' | 'crew' | 'impostor'>('all');
  const [showHistory, setShowHistory] = useState(false);

  const history = getMatchHistory();

  const filteredEntries = summary.leaderboard.filter(e => {
    if (teamFilter === 'all') return true;
    return e.role === teamFilter;
  });

  const sortedEntries = sortLeaderboard(filteredEntries, activeSort);
  const topThree = sortedEntries.slice(0, 3);

  const isCrewWinner = summary.winnerTeam === 'crew';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#1d3a2f] border-2 border-[#335a49] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-[#f3efdc] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Banner Kemenangan Tim Berdasarkan Siapa yang Tersisa */}
        <div className={`p-5 sm:p-6 text-center border-b border-[#335a49] ${
          isCrewWinner 
            ? 'bg-gradient-to-b from-[#1b4332] to-[#1d3a2f]' 
            : 'bg-gradient-to-b from-[#4a1c17] to-[#1d3a2f]'
        }`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2 tracking-wide uppercase bg-black/30 border border-white/10">
            {isCrewWinner ? <Shield className="w-3.5 h-3.5 text-[#6fd08c]" /> : <Skull className="w-3.5 h-3.5 text-[#ef6b5b]" />}
            Hasil Akhir Pertandingan Tim
          </div>

          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight mb-2 text-[#f5d547]">
            {summary.winnerTitle}
          </h2>
          
          <p className="text-sm sm:text-base text-[#f3efdc]/90 max-w-xl mx-auto leading-relaxed">
            {summary.reason}
          </p>

          {/* Statistik Bertahan Hidup (Siapa yang Tersisa) */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-4 pt-4 border-t border-white/10 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6fd08c]"></span>
              <span className="text-[#a9bdb2]">Kru Tersisa:</span>
              <span className="font-bold text-[#f3efdc]">{summary.survivingCrewCount} / {summary.totalCrewCount} hidup</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef6b5b]"></span>
              <span className="text-[#a9bdb2]">Penyusup Tersisa:</span>
              <span className="font-bold text-[#f3efdc]">{summary.survivingImpostorCount} / {summary.totalImpostorCount} hidup</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#f5d547]" />
              <span className="text-[#a9bdb2]">Durasi:</span>
              <span className="font-bold text-[#f3efdc]">{formatDuration(summary.matchDuration)}</span>
            </div>
          </div>
        </div>

        {/* Konten Utama: Tabs & Leaderboard */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* Navigasi Filter & Kategori Leaderboard */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Tab Kategori Penilaian yang Diminta Pengguna */}
            <div className="flex flex-wrap gap-1 p-1 bg-[#14261f] rounded-xl border border-[#335a49]">
              <button
                onClick={() => setActiveSort('composite')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeSort === 'composite' 
                    ? 'bg-[#f5d547] text-[#14261f] font-bold shadow' 
                    : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                Total Skor
              </button>

              <button
                onClick={() => setActiveSort('score')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeSort === 'score' 
                    ? 'bg-[#f5d547] text-[#14261f] font-bold shadow' 
                    : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Skor Soal
              </button>

              <button
                onClick={() => setActiveSort('survival')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeSort === 'survival' 
                    ? 'bg-[#f5d547] text-[#14261f] font-bold shadow' 
                    : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Lama Bertahan
              </button>

              <button
                onClick={() => setActiveSort('speed')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeSort === 'speed' 
                    ? 'bg-[#f5d547] text-[#14261f] font-bold shadow' 
                    : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Kecepatan Jawab
              </button>
            </div>

            {/* Filter Tim */}
            <div className="flex items-center gap-1 text-xs self-end sm:self-auto">
              <span className="text-[#a9bdb2] mr-1">Tim:</span>
              <button
                onClick={() => setTeamFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  teamFilter === 'all' ? 'bg-[#335a49] text-white font-medium' : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setTeamFilter('crew')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  teamFilter === 'crew' ? 'bg-[#2f634b] text-[#6fd08c] font-medium' : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                Kru
              </button>
              <button
                onClick={() => setTeamFilter('impostor')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  teamFilter === 'impostor' ? 'bg-[#632f2b] text-[#ef6b5b] font-medium' : 'text-[#a9bdb2] hover:text-[#f3efdc]'
                }`}
              >
                Penyusup
              </button>
            </div>
          </div>

          {/* Visual Podium Top 3 */}
          {topThree.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 pb-2 items-end max-w-lg mx-auto">
              {/* Posisi 2 (Perak) */}
              {topThree[1] && (
                <div className="flex flex-col items-center bg-[#14261f]/80 p-3 rounded-xl border border-[#335a49] text-center order-1">
                  <span className="text-xl mb-1">🥈</span>
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-1.5 border-2 border-slate-300"
                    style={{ backgroundColor: topThree[1].color, color: '#111' }}
                  >
                    {topThree[1].name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-xs truncate max-w-[90px]">{topThree[1].name} {topThree[1].isMe && "(Kamu)"}</span>
                  <span className="text-[11px] text-[#a9bdb2]">{topThree[1].role === 'crew' ? 'Kru' : 'Penyusup'}</span>
                  <span className="text-xs font-bold text-[#f5d547] mt-1 tabular-nums">
                    {activeSort === 'score' ? `${topThree[1].scoreTasks} Soal` : 
                     activeSort === 'survival' ? formatDuration(topThree[1].survivalTime) : 
                     activeSort === 'speed' ? `${topThree[1].avgSpeed}s/soal` : 
                     `${topThree[1].compositeScore} Poin`}
                  </span>
                </div>
              )}

              {/* Posisi 1 (Emas) */}
              {topThree[0] && (
                <div className="flex flex-col items-center bg-[#1b3429] p-4 rounded-xl border-2 border-[#f5d547]/60 text-center order-0 sm:order-1 -mt-2 shadow-lg">
                  <span className="text-2xl mb-1">👑</span>
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base mb-1.5 border-2 border-[#f5d547] shadow"
                    style={{ backgroundColor: topThree[0].color, color: '#111' }}
                  >
                    {topThree[0].name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-sm truncate max-w-[100px] text-[#f5d547]">
                    {topThree[0].name} {topThree[0].isMe && "(Kamu)"}
                  </span>
                  <span className="text-[11px] text-[#6fd08c]">{topThree[0].role === 'crew' ? 'Kru Detektif' : 'Penyusup'}</span>
                  <span className="text-sm font-bold text-[#f5d547] mt-1 tabular-nums">
                    {activeSort === 'score' ? `${topThree[0].scoreTasks} Soal Benar` : 
                     activeSort === 'survival' ? `${formatDuration(topThree[0].survivalTime)} Bertahan` : 
                     activeSort === 'speed' ? `${topThree[0].avgSpeed}s/soal` : 
                     `${topThree[0].compositeScore} Poin Total`}
                  </span>
                </div>
              )}

              {/* Posisi 3 (Perunggu) */}
              {topThree[2] && (
                <div className="flex flex-col items-center bg-[#14261f]/80 p-3 rounded-xl border border-[#335a49] text-center order-2">
                  <span className="text-xl mb-1">🥉</span>
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-1.5 border-2 border-amber-700"
                    style={{ backgroundColor: topThree[2].color, color: '#111' }}
                  >
                    {topThree[2].name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-xs truncate max-w-[90px]">{topThree[2].name} {topThree[2].isMe && "(Kamu)"}</span>
                  <span className="text-[11px] text-[#a9bdb2]">{topThree[2].role === 'crew' ? 'Kru' : 'Penyusup'}</span>
                  <span className="text-xs font-bold text-[#f5d547] mt-1 tabular-nums">
                    {activeSort === 'score' ? `${topThree[2].scoreTasks} Soal` : 
                     activeSort === 'survival' ? formatDuration(topThree[2].survivalTime) : 
                     activeSort === 'speed' ? `${topThree[2].avgSpeed}s/soal` : 
                     `${topThree[2].compositeScore} Poin`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tabel Peringkat Lengkap */}
          <div className="bg-[#14261f] border border-[#335a49] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#111f19] text-[#a9bdb2] border-b border-[#335a49] font-medium">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Pemain</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#6fd08c]" />
                        Skor Soal
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#f5d547]" />
                        Bertahan
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Zap className="w-3.5 h-3.5 text-[#7fdcff]" />
                        Kecepatan
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-right font-bold text-[#f5d547]">Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#335a49]/60">
                  {sortedEntries.map((player) => (
                    <tr 
                      key={player.id} 
                      className={`hover:bg-[#1d3a2f]/70 transition-colors ${
                        player.isMe ? 'bg-[#f5d547]/10 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-bold text-xs text-[#a9bdb2]">
                        {player.rank === 1 ? '🥇 1' : 
                         player.rank === 2 ? '🥈 2' : 
                         player.rank === 3 ? '🥉 3' : 
                         `#${player.rank}`}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-4 h-4 rounded-full border border-black/30 shrink-0" 
                            style={{ backgroundColor: player.color }}
                          />
                          <div>
                            <span className="font-semibold text-[#f3efdc]">
                              {player.name}
                            </span>
                            {player.isMe && (
                              <span className="ml-1.5 text-[10px] bg-[#f5d547] text-[#14261f] font-bold px-1.5 py-0.2 rounded">
                                Kamu
                              </span>
                            )}
                            <div className="text-[11px] text-[#a9bdb2]">
                              {player.role === 'crew' ? 'Detektif Kru' : 'Penyusup'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Bertahan Hidup (Siapa yang Tersisa) */}
                      <td className="py-3 px-3">
                        {player.survived ? (
                          <span className="inline-flex items-center gap-1 text-[#6fd08c] text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-[#6fd08c] animate-pulse"></span>
                            Tersisa (Hidup)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#ef6b5b] text-xs">
                            <Skull className="w-3 h-3" />
                            Gugur ({formatDuration(player.survivalTime)})
                          </span>
                        )}
                      </td>

                      {/* Skor Soal */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-semibold text-[#f3efdc]">
                          {player.scoreTasks} Soal
                        </div>
                        <div className="text-[11px] text-[#a9bdb2]">
                          Akurasi {player.accuracy}%
                        </div>
                      </td>

                      {/* Lama Bertahan */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-semibold text-[#f3efdc]">
                          {formatDuration(player.survivalTime)}
                        </div>
                        <div className="text-[11px] text-[#a9bdb2]">
                          {player.survived ? 'Sampai Selesai' : 'Tereliminasi'}
                        </div>
                      </td>

                      {/* Kecepatan Pengerjaan */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-semibold text-[#f3efdc]">
                          {player.avgSpeed > 0 ? `${player.avgSpeed} dtk` : '-'}
                        </div>
                        <div className="text-[11px] text-[#a9bdb2]">
                          {player.avgSpeed > 0 ? 'per soal' : 'belum tugas'}
                        </div>
                      </td>

                      {/* Total Poin Komposit */}
                      <td className="py-3 px-3 text-right font-bold text-[#f5d547] tabular-nums text-sm">
                        {player.compositeScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Riwayat Pertandingan Sebelumnya (Collapsible) */}
          {history.length > 1 && (
            <div className="border border-[#335a49] rounded-xl p-3 bg-[#14261f]/60">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#a9bdb2] hover:text-[#f3efdc]"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#f5d547]" />
                  Riwayat Pertandingan Sebelumnya ({history.length} Permainan)
                </span>
                <span>{showHistory ? 'Tutup ▲' : 'Buka ▼'}</span>
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-[#335a49]">
                  {history.slice(1, 6).map((h, i) => (
                    <div key={h.id || i} className="flex items-center justify-between text-xs p-2 rounded bg-[#1d3a2f] border border-[#335a49]/60">
                      <div>
                        <span className="font-bold text-[#f5d547]">{h.winnerTitle}</span>
                        <div className="text-[11px] text-[#a9bdb2]">{h.date} · Durasi {formatDuration(h.matchDuration)}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-[#6fd08c]">
                          Kru: {h.survivingCrewCount}/{h.totalCrewCount}
                        </span>
                        <span className="text-[11px] text-[#a9bdb2] ml-2">
                          Penyusup: {h.survivingImpostorCount}/{h.totalImpostorCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#14261f] border-t border-[#335a49] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#a9bdb2]">
            Kemenangan tim dihitung berdasarkan tim dengan anggota yang bertahan hidup.
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onBackToMenu}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-[#1d3a2f] text-[#f3efdc] border border-[#335a49] hover:bg-[#25493b] transition-colors flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" />
              Menu Utama
            </button>

            <button
              onClick={onPlayAgain}
              className="px-5 py-2 text-sm font-bold rounded-xl bg-[#f5d547] text-[#14261f] hover:bg-[#fad85e] transition-colors shadow-lg flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Main Lagi
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
