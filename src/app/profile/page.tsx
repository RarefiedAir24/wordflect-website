"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService, UserProfile } from "@/services/api";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "1y" | "all">("30d");
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Record<string, boolean>>({});

  // Derived UI helpers
  const winRate = (p: UserProfile) => {
    const total = p.battleWins + p.battleLosses;
    if (total === 0) return 0;
    return Math.round((p.battleWins / total) * 100);
  };

  const estimatedLevelProgress = (p: UserProfile) => {
    const perLevel = 1000;
    const remainder = p.points % perLevel;
    return Math.round((remainder / perLevel) * 100);
  };

  const longestRecentWord = (p: UserProfile) => {
    const words = p.allFoundWords.map(w => (typeof w === 'string' ? w : w.word));
    return words.reduce((a, b) => (b && b.length > (a?.length || 0) ? b : a), "");
  };

  // Historical aggregation derived from words list
  const aggregated = (p: UserProfile) => {
    type WordEntry = { word: string; date: Date };
    const entries: WordEntry[] = p.allFoundWords
      .map((w) => {
        if (typeof w === 'string') return { word: w, date: new Date() };
        const d = w.date ? new Date(w.date) : new Date();
        return { word: w.word, date: isNaN(d.getTime()) ? new Date() : d };
      })
      .filter((e) => !!e.word);

    const now = new Date();
    const start = (() => {
      const d = new Date(now);
      if (range === '7d') { d.setDate(d.getDate() - 6); return d; }
      if (range === '30d') { d.setDate(d.getDate() - 29); return d; }
      if (range === '90d') { d.setDate(d.getDate() - 89); return d; }
      if (range === '1y') { d.setFullYear(d.getFullYear() - 1); return d; }
      return new Date(0);
    })();

    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dayCounts = new Map<string, { date: Date; count: number; avgLenSum: number; lenCount: number }>();
    entries.forEach((e) => {
      if (e.date < start) return;
      const k = keyOf(e.date);
      if (!dayCounts.has(k)) dayCounts.set(k, { date: new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()), count: 0, avgLenSum: 0, lenCount: 0 });
      const rec = dayCounts.get(k)!;
      rec.count += 1;
      rec.avgLenSum += e.word.length;
      rec.lenCount += 1;
    });

    const days: { date: Date; value: number; avgLen?: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= now) {
      const k = keyOf(cursor);
      const rec = dayCounts.get(k);
      days.push({ date: new Date(cursor), value: rec?.count || 0, avgLen: rec && rec.lenCount ? rec.avgLenSum / rec.lenCount : undefined });
      cursor.setDate(cursor.getDate() + 1);
    }

    const values = days.map(d => d.value);
    const max = Math.max(1, ...values);
    const totalWords = values.reduce((a, b) => a + b, 0);
    const avgPerDay = days.length ? Math.round(totalWords / days.length) : 0;
    const uniqueWords = new Set(entries.map(e => e.word.toLowerCase())).size;
    const avgLenAll = (() => {
      const arr = entries.map(e => e.word.length);
      return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    })();

    const filtered = entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    return { days, max, totalWords, avgPerDay, uniqueWords, avgLenAll, filtered };
  };

  // Backend history integration
  const [historyDays, setHistoryDays] = useState<{ date: Date; value: number; avgLen?: number }[] | null>(null);
  
  useEffect(() => {
    const load = async () => {
      try {
        if (!apiService.isAuthenticated()) return;
        const res = await apiService.getUserHistory({ range });
        const parsed = Array.isArray(res.days) ? res.days.map(d => ({
          date: new Date(d.date),
          value: typeof d.value === 'number' ? d.value : 0,
          avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined
        })) : [];
        setHistoryDays(parsed);
      } catch {
        console.warn('Falling back to client aggregation for history');
        setHistoryDays(null);
      }
    };
    load();
  }, [range]);


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!apiService.isAuthenticated()) {
          router.push("/signin");
          return;
        }

        const userProfile = await apiService.getUserProfile();
        console.log('Profile data:', userProfile);
        console.log('Profile image URL:', userProfile.profileImageUrl);
        console.log('Selected frame:', userProfile.selectedFrame);
        setProfile(userProfile);
      } catch (error) {
        console.error("Profile fetch error:", error);
        setError(error instanceof Error ? error.message : "Failed to load profile");
        if (error instanceof Error && error.message.includes("Authentication failed")) {
          router.push("/signin");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const handleVisibilityChange = () => {
      if (!document.hidden && apiService.isAuthenticated()) {
        fetchProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router]);

  const handleSignOut = async () => {
    await apiService.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-4">
        <div className="bg-red-100 rounded-lg p-8 shadow text-red-900 text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Profile</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => router.push("/signin")}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition"
          >
            Sign In Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-1 mb-8">
        <div className="rounded-2xl bg-blue-100/90 text-blue-900 p-6 md:p-8 backdrop-blur">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="relative">
                {profile.profileImageUrl && profile.profileImageUrl.trim() !== '' ? (
                  <Image
                    src={profile.profileImageUrl}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="rounded-full border-4 border-white shadow-xl"
                    onError={() => {
                      console.error('Profile image failed to load:', profile.profileImageUrl);
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-3xl font-bold text-gray-600">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {profile.selectedFrame && (
                  <div className="absolute -inset-10 pointer-events-none">
                    <Image
                      src={profile.selectedFrame.imageUrl}
                      alt={profile.selectedFrame.name}
                      width={160}
                      height={160}
                      className="w-40 h-40 object-contain"
                      onError={() => {
                        console.error('Frame image failed to load:', profile.selectedFrame?.imageUrl);
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-blue-950">{profile.username}</h1>
                <p className="text-blue-700">{profile.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">Level {profile.highestLevel}</span>
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">Win Rate {winRate(profile)}%</span>
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-semibold">{profile.allFoundWords.length.toLocaleString()} Words</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLoading(true);
                  apiService.getUserProfile().then(setProfile).catch(console.error).finally(() => setLoading(false));
                }}
                className="bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600 transition shadow"
              >
                Refresh
              </button>
              <a href="/dashboard">
                <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded hover:scale-105 transition font-bold shadow">
                  Dashboard
                </button>
              </a>
              <button onClick={handleSignOut} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition shadow">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Flectcoins" value={profile.flectcoins.toLocaleString()} accent="from-amber-400 to-yellow-500" />
        <MetricCard title="Points" value={profile.points.toLocaleString()} accent="from-blue-400 to-indigo-500" />
        <MetricCard title="Gems" value={profile.gems.toLocaleString()} accent="from-pink-400 to-rose-500" />
        <div className="bg-white rounded-xl p-5 shadow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-950">Level Progress</h3>
                <p className="text-sm text-blue-700">Level {profile.highestLevel}</p>
              </div>
              <RadialProgress percent={estimatedLevelProgress(profile)} />
            </div>
          </div>
        </div>
      </div>

      {/* Deep Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-xl p-5 shadow lg:col-span-2">
          <h3 className="font-bold text-lg mb-4 text-blue-950">Game & Battle</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MiniStat title="Games Played" value={profile.gamesPlayed.toLocaleString()} subtitle="Lifetime" />
            <MiniStat title="Top Score" value={profile.topScore.toLocaleString()} subtitle="Best single game" />
            <MiniStat title="Longest Word" value={profile.longestWord || longestRecentWord(profile) || "None"} subtitle="Record" />
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-100 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-blue-950">Battle Performance</h4>
                <span className="text-sm text-blue-700">{winRate(profile)}% win rate</span>
              </div>
              <div className="mt-4 flex items-end gap-3 h-24">
                <Bar title="Wins" value={profile.battleWins} color="bg-emerald-500" total={Math.max(profile.battleWins, profile.battleLosses, 1)} />
                <Bar title="Losses" value={profile.battleLosses} color="bg-rose-500" total={Math.max(profile.battleWins, profile.battleLosses, 1)} />
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-blue-950">Leaderboard Podiums</h4>
                <span className="text-sm text-blue-700">Total {(profile.firstPlaceFinishes + profile.secondPlaceFinishes + profile.thirdPlaceFinishes).toLocaleString()}</span>
              </div>
              <div className="mt-4 flex items-end gap-3 h-24">
                <Bar title="🥇" value={profile.firstPlaceFinishes} color="bg-amber-500" total={Math.max(profile.firstPlaceFinishes, profile.secondPlaceFinishes, profile.thirdPlaceFinishes, 1)} />
                <Bar title="🥈" value={profile.secondPlaceFinishes} color="bg-gray-400" total={Math.max(profile.firstPlaceFinishes, profile.secondPlaceFinishes, profile.thirdPlaceFinishes, 1)} />
                <Bar title="🥉" value={profile.thirdPlaceFinishes} color="bg-orange-500" total={Math.max(profile.firstPlaceFinishes, profile.secondPlaceFinishes, profile.thirdPlaceFinishes, 1)} />
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-white rounded-xl p-5 shadow">
          <h3 className="font-bold text-lg mb-2 text-blue-950">AI Insights</h3>
          <p className="text-sm text-blue-700 mb-4">On-device tips generated from your recent performance.</p>
          <ul className="space-y-2">
            {generateInsights(profile).map((tip, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-blue-900 text-sm">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Words & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historical & Sparkline */}
        <div className="bg-white rounded-xl p-5 shadow lg:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h3 className="font-bold text-lg text-blue-950">History</h3>
            <div className="flex items-center gap-2">
              {(["7d","30d","90d","1y","all"] as const).map(r => (
                <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-sm border ${range===r? 'bg-blue-600 text-white border-blue-600':'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'}`}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <Sparkline data={(historyDays && historyDays.length ? historyDays : aggregated(profile).days)} height={96} color="#4f46e5" />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MiniStat title="Words (range)" value={(historyDays && historyDays.length ? historyDays.reduce((a,b)=>a+b.value,0) : aggregated(profile).totalWords).toLocaleString()} />
            <MiniStat title="Avg/Day" value={(historyDays && historyDays.length ? Math.round(historyDays.reduce((a,b)=>a+b.value,0) / historyDays.length) : aggregated(profile).avgPerDay)} />
            <MiniStat title="Avg Length" value={(historyDays && historyDays.length ? (()=>{ const sum = historyDays.reduce((a,b)=> a + (b.avgLen || 0), 0); const cnt = historyDays.filter(d=>d.avgLen!==undefined).length; return cnt? (sum/cnt).toFixed(1) : '0.0'; })() : (aggregated(profile).avgLenAll ? aggregated(profile).avgLenAll.toFixed(1) : '0.0'))} />
          </div>
        </div>

        {/* Activity Snapshot */}
        <div className="bg-white rounded-xl p-5 shadow">
          <h3 className="font-bold text-lg mb-2 text-blue-950">Activity Snapshot</h3>
          <div className="space-y-2 text-sm text-blue-900">
            <div className="flex items-center justify-between"><span>Leaderboard Placements</span><span className="font-semibold">{profile.leaderboardPlacements}</span></div>
            <div className="flex items-center justify-between"><span>Current Level</span><span className="font-semibold">{profile.highestLevel}</span></div>
          </div>
        </div>
      </div>

      {/* Interactivity: Words Explorer (Accordion Modal) */}
      <div className="mt-8 bg-white rounded-xl p-5 shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg text-blue-950">Words Explorer</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadCsv(aggregated(profile).filtered)} className="px-3 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700">Export CSV</button>
            <button onClick={() => setIsExplorerOpen(true)} className="px-3 py-2 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-700">Open</button>
          </div>
        </div>
        <p className="text-sm text-blue-700">Browse words by starting letter in a focused modal.</p>
      </div>

      {isExplorerOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsExplorerOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-blue-100">
              <h4 className="font-bold text-blue-950">Words Explorer</h4>
              <button onClick={() => setIsExplorerOpen(false)} className="px-2 py-1 rounded text-sm border border-blue-200 hover:bg-blue-50">Close</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {(() => {
                const map = new Map<string, { first: Date; last: Date; count: number }>();
                aggregated(profile).filtered.forEach(e => {
                  const key = (e.word || '').toLowerCase();
                  if (!key) return;
                  const info = map.get(key) || { first: e.date, last: e.date, count: 0 };
                  info.first = e.date < info.first ? e.date : info.first;
                  info.last = e.date > info.last ? e.date : info.last;
                  info.count += 1;
                  map.set(key, info);
                });
                const groups: Record<string, Array<{ word: string; first: Date; last: Date; count: number }>> = {};
                map.forEach((v, k) => {
                  const letter = /^[a-z]/i.test(k) ? k[0].toUpperCase() : '#';
                  if (!groups[letter]) groups[letter] = [];
                  groups[letter].push({ word: k, first: v.first, last: v.last, count: v.count });
                });
                const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].filter(l => groups[l]?.length);
                letters.forEach(l => groups[l].sort((a,b) => a.word.localeCompare(b.word)));
                const toggle = (l: string) => setExpandedLetters(s => ({ ...s, [l]: !s[l] }));
                return (
                  <div className="space-y-2">
                    {letters.map(l => (
                      <div key={l} className="border border-blue-100 rounded-lg overflow-hidden">
                        <button onClick={() => toggle(l)} className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 hover:bg-blue-100">
                          <span className="font-semibold text-blue-950">{l}</span>
                          <span className="text-xs text-blue-700">{groups[l].length} words</span>
                        </button>
                        {expandedLetters[l] && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-white">
                                <tr className="text-blue-900">
                                  <th className="px-3 py-2 text-left font-semibold">Word</th>
                                  <th className="px-3 py-2 text-left font-semibold">First Found</th>
                                  <th className="px-3 py-2 text-left font-semibold">Most Recent</th>
                                  <th className="px-3 py-2 text-left font-semibold">Times Found</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groups[l].map((row, idx) => (
                                  <tr key={idx} className="odd:bg-blue-50/30 even:bg-white">
                                    <td className="px-3 py-2 font-medium text-blue-950">{row.word}</td>
                                    <td className="px-3 py-2 text-blue-800">{row.first.toLocaleDateString()}</td>
                                    <td className="px-3 py-2 text-blue-800">{row.last.toLocaleDateString()}</td>
                                    <td className="px-3 py-2 text-blue-800">{row.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                    {!letters.length && (
                      <div className="text-sm text-blue-700">No words found.</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// UI Subcomponents
function MetricCard({ title, value, accent }: { title: string; value: string | number; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-5 shadow bg-white">
      <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${accent}`} />
      <div className="relative">
        <p className="text-sm text-blue-700">{title}</p>
        <p className="mt-1 text-2xl font-extrabold text-blue-950">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-blue-100 p-4">
      <p className="text-sm text-blue-700">{title}</p>
      <p className="mt-1 text-xl font-bold text-blue-950">{value}</p>
      {subtitle && <p className="text-xs text-blue-600">{subtitle}</p>}
    </div>
  );
}

function Bar({ title, value, color, total }: { title: string; value: number; color: string; total: number }) {
  const height = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 6;
  return (
    <div className="flex flex-col items-center justify-end h-full min-w-[48px]">
      <div className={`w-8 ${color} rounded-t`} style={{ height: `${height}%` }} />
      <div className="mt-2 text-xs text-blue-900 font-semibold">{title}</div>
      <div className="text-[11px] text-blue-700">{value}</div>
    </div>
  );
}

function RadialProgress({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative grid place-items-center" style={{ width: 72, height: 72 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#7c3aed ${clamped * 3.6}deg, #e5e7eb 0deg)`,
        }}
      />
      <div className="absolute inset-2 rounded-full bg-white grid place-items-center">
        <span className="text-sm font-bold text-blue-950">{`${clamped}%`}</span>
      </div>
    </div>
  );
}

function Sparkline({ data, height = 80, color = '#4f46e5' }: { data: { date: Date; value: number }[]; height?: number; color?: string }) {
  const width = Math.max(240, data.length * 6);
  const max = Math.max(1, ...data.map(d => d.value));
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * (width - 8) + 4;
    const y = height - (d.value / max) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const area = `4,${height-4} ${points} ${width-4},${height-4}`;
  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="block">
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={area} fill={`${color}20`} stroke="none" />
      </svg>
    </div>
  );
}

function downloadCsv(data: { word: string; date: Date }[]) {
  const header = 'word,date\n';
  const rows = data.map(d => `${escapeCsv(d.word)},${d.date.toISOString()}`).join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wordflect_words_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replaceAll('"', '""') + '"';
  }
  return value;
}

function generateInsights(p: UserProfile): string[] {
  const insights: string[] = [];
  const rate = (p.battleWins + p.battleLosses) > 0 ? (p.battleWins / (p.battleWins + p.battleLosses)) : 0;
  if (rate >= 0.6) insights.push("Strong battle form. Try higher-stakes matches for bonus rewards.");
  else if (rate > 0) insights.push("Focus on mid-length words (6-8 letters) to boost win rate.");
  else insights.push("Play a few battles to unlock tailored coaching.");

  if (p.points > 0) {
    const prog = p.points % 1000;
    if (prog > 750) insights.push("You're close to leveling up. A short session could push you over.");
    else if (prog < 250) insights.push("Fresh level—stack small streaks to build momentum.");
  }

  const words = p.allFoundWords.map(w => (typeof w === 'string' ? w : w.word)).filter(Boolean);
  const avgLen = words.length ? Math.round(words.reduce((a, w) => a + w.length, 0) / words.length) : 0;
  if (avgLen >= 7) insights.push("Great vocabulary depth. Mix in shorter words for rapid scoring.");
  else if (avgLen > 0) insights.push("Quick finds are solid. Hunt for one long word each game.");

  insights.push(`Gem efficiency tip: Convert surplus points into gems when events start.`);
  return insights.slice(0, 4);
}
