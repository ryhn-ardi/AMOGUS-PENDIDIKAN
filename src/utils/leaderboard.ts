import { Player, LeaderboardEntry, MatchSummary } from '../types/game';

export function calculateLeaderboard(players: Player[], matchDuration: number): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = players.map(player => {
    const survivalTime = player.dead && player.eliminatedAt !== null 
      ? Math.round(player.eliminatedAt) 
      : Math.round(matchDuration);

    const accuracy = player.totalAttempts > 0 
      ? Math.round((player.correctAnswers / player.totalAttempts) * 100) 
      : 0;

    const avgSpeed = player.taskDurations.length > 0
      ? Number((player.taskDurations.reduce((a, b) => a + b, 0) / player.taskDurations.length).toFixed(1))
      : 0;

    // Composite score formula incorporating question score, survival time, and answering speed
    const questionPoints = player.correctAnswers * 120;
    const accuracyBonus = Math.round(accuracy * 2);
    const survivalPoints = survivalTime * 2 + (player.dead ? 0 : 250);
    const speedBonus = player.correctAnswers > 0 && avgSpeed > 0
      ? Math.max(0, Math.round((12 - Math.min(12, avgSpeed)) * 15 * player.correctAnswers))
      : 0;
    
    // Role adjustment (Impostors get elimination / disruption bonus)
    const roleBonus = player.role === 'impostor' ? (player.dead ? 50 : 200) : 0;

    const compositeScore = questionPoints + accuracyBonus + survivalPoints + speedBonus + roleBonus;

    return {
      id: player.id,
      name: player.name,
      role: player.role,
      isMe: player.isMe,
      color: player.color,
      scoreTasks: player.correctAnswers,
      totalAttempts: player.totalAttempts,
      accuracy,
      survivalTime,
      survived: !player.dead,
      avgSpeed,
      compositeScore
    };
  });

  // Sort by composite score by default
  return entries.sort((a, b) => b.compositeScore - a.compositeScore).map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));
}

export function sortLeaderboard(
  entries: LeaderboardEntry[], 
  sortBy: 'composite' | 'score' | 'survival' | 'speed'
): LeaderboardEntry[] {
  const sorted = [...entries];

  switch (sortBy) {
    case 'score':
      sorted.sort((a, b) => {
        if (b.scoreTasks !== a.scoreTasks) return b.scoreTasks - a.scoreTasks;
        return b.accuracy - a.accuracy;
      });
      break;

    case 'survival':
      sorted.sort((a, b) => {
        if (a.survived !== b.survived) return a.survived ? -1 : 1;
        return b.survivalTime - a.survivalTime;
      });
      break;

    case 'speed':
      sorted.sort((a, b) => {
        // Only players who answered at least 1 question
        if (a.avgSpeed === 0 && b.avgSpeed > 0) return 1;
        if (b.avgSpeed === 0 && a.avgSpeed > 0) return -1;
        if (a.avgSpeed !== b.avgSpeed) return a.avgSpeed - b.avgSpeed;
        return b.scoreTasks - a.scoreTasks;
      });
      break;

    case 'composite':
    default:
      sorted.sort((a, b) => b.compositeScore - a.compositeScore);
      break;
  }

  return sorted.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

const STORAGE_KEY = 'dk_match_history_v2';

export function saveMatchResult(summary: MatchSummary) {
  try {
    const existing = getMatchHistory();
    const updated = [summary, ...existing].slice(0, 20); // Keep last 20 games
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save match history', e);
  }
}

export function getMatchHistory(): MatchSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearMatchHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
