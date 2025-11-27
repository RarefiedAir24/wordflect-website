"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService, UserProfile } from "@/services/api";
import MissionResetCountdown from "@/components/MissionResetCountdown";
import CalendarModal from "@/components/CalendarModal";
import CurrencyHistoryModal from "@/components/CurrencyHistoryModal";

// Types for theme day responses from backend (used in modal rendering)
type ThemeDayWord = { word: string; length?: number; found?: boolean };
type ThemeDayTheme = { name: string; words: string[]; dailyGoal?: number; totalWords?: number };
type ThemeDayStats = { totalThemeWordsFound?: number; completionRate?: number; isCompleted?: boolean; wordsFound?: Array<string | { word: string }> };
type ThemeDayProgress = { wordsFound?: string[]; foundWords?: string[]; completionPercent?: number };
type ThemeDayResponse = {
  success?: boolean;
  day?: string;
  date?: string;
  theme?: ThemeDayTheme;
  stats?: ThemeDayStats;
  progress?: ThemeDayProgress;
  allThemeWords?: ThemeDayWord[];
  themeWordsFound?: Array<string | { word: string }>;
  timestamp?: string;
};

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const statsUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [historyRange, setHistoryRange] = useState<"7d" | "30d" | "90d" | "1y" | "all" | "custom">("30d");
  const [sessionsRange, setSessionsRange] = useState<"7d" | "30d" | "90d" | "1y" | "all" | "custom">("7d");
  const [customHistoryDateRange, setCustomHistoryDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [customSessionsDateRange, setCustomSessionsDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Record<string, boolean>>({});
  const [timeAnalytics, setTimeAnalytics] = useState<Record<string, unknown> | null>(null);
  const [themeAnalytics, setThemeAnalytics] = useState<Record<string, unknown> | null>(null);
  const [isLoadingThemeAnalytics, setIsLoadingThemeAnalytics] = useState(true);
  const [selectedThemeDay, setSelectedThemeDay] = useState<string | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isRefreshingTimeAnalytics, setIsRefreshingTimeAnalytics] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [lastAnalyticsRaw, setLastAnalyticsRaw] = useState<unknown>(null);
  useEffect(() => {
    if (lastAnalyticsRaw !== null) {
      console.log('🧪 Inspect raw analytics payload:', lastAnalyticsRaw);
    }
  }, [lastAnalyticsRaw]);

  // Keep linter happy and log modal visibility changes for debugging
  useEffect(() => {
    console.log('🔎 Inspect modal', isInspectOpen ? 'opened' : 'closed');
  }, [isInspectOpen]);
  // const [refreshing, setRefreshing] = useState(false); // Removed: no manual refresh in production
  
  // Calendar modal states
  const [calendarModal, setCalendarModal] = useState<{
    isOpen: boolean;
    type: 'days-active' | 'current-streak' | 'best-streak' | null;
    title: string;
    data: { date: string; active: boolean }[];
    startDate?: string;
    endDate?: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    data: []
  });
  
  const [aiModalOpen, setAiModalOpen] = useState(false);
  
  // Longest word modal state (for both all-time and today's longest)
  const [longWordModal, setLongWordModal] = useState<{
    isOpen: boolean;
    word: string;
    date: string | null;
    title: string;
    history?: Array<{ word: string; date: string; replacedBy?: string; replacedDate?: string }>;
  }>({
    isOpen: false,
    word: '',
    date: null,
    title: '',
    history: [],
  });
  
  // Top score modal state
  const [topScoreModal, setTopScoreModal] = useState<{
    isOpen: boolean;
    score: number;
    date: string | null;
    title: string;
    history?: Array<{ score: number; date: string; replacedBy?: number; replacedDate?: string }>;
  }>({
    isOpen: false,
    score: 0,
    date: null,
    title: '',
    history: [],
  });
  
  // Currency history modal state
  const [currencyModal, setCurrencyModal] = useState<{
    isOpen: boolean;
    type: 'flectcoins' | 'gems' | null;
  }>({
    isOpen: false,
    type: null,
  });
  
  // Leaderboard placements modal state
  const [leaderboardModal, setLeaderboardModal] = useState<{
    isOpen: boolean;
    filter: 'all' | 'gold' | 'silver' | 'bronze';
  }>({
    isOpen: false,
    filter: 'all',
  });
  
  // Battle history modal state
  const [battleModal, setBattleModal] = useState<{
    isOpen: boolean;
    filter: 'all' | 'wins' | 'losses';
  }>({
    isOpen: false,
    filter: 'all',
  });
  const [currencyHistory, setCurrencyHistory] = useState<{
    transactions: Array<{
      id: string;
      type: 'flectcoins' | 'gems';
      amount: number;
      reason: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>;
    summary: {
      flectcoins: { earned: number; spent: number; net: number };
      gems: { earned: number; spent: number; net: number };
    };
  } | null>(null);
  const [isLoadingCurrencyHistory, setIsLoadingCurrencyHistory] = useState(false);
  const aiInputRef = useRef<HTMLInputElement | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [showLexiPopup, setShowLexiPopup] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  

  // Derived UI helpers
  const winRate = (p: UserProfile) => {
    const total = p.battleWins + p.battleLosses;
    if (total === 0) return 0;
    return Math.round((p.battleWins / total) * 100);
  };


  const longestRecentWord = (p: UserProfile) => {
    const words = p.allFoundWords.map(w => (typeof w === 'string' ? w : w.word));
    return words.reduce((a, b) => (b && b.length > (a?.length || 0) ? b : a), "");
  };

  // Historical aggregation derived from words list
  const aggregated = React.useCallback((p: UserProfile) => {
    type WordEntry = { word: string; date: Date };
    const entries: WordEntry[] = p.allFoundWords
      .map((w) => {
        // Only include entries with a valid date to avoid attributing undated words to "today"
        if (typeof w === 'string') return null; // skip undated string entries
        if (!w.date) return null; // skip if no date
        const d = new Date(w.date);
        if (isNaN(d.getTime())) return null; // skip invalid dates
        return { word: w.word, date: d } as WordEntry;
      })
      .filter((e): e is WordEntry => !!e && !!e.word);

    const now = new Date();
    const start = (() => {
      const d = new Date(now);
      // Use UTC for date calculations to match backend
      if (historyRange === '7d') { d.setUTCDate(d.getUTCDate() - 6); return d; }
      if (historyRange === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d; } // 30 days including today
      if (historyRange === '90d') { d.setUTCDate(d.getUTCDate() - 89); return d; } // 90 days including today
      if (historyRange === '1y') { d.setUTCFullYear(d.getUTCFullYear() - 1); return d; }
      if (historyRange === 'all') { 
        // Find the earliest date from user's words
        const earliestDate = entries.length > 0 
          ? new Date(Math.min(...entries.map(e => e.date.getTime())))
          : new Date(now);
        return earliestDate;
      }
      if (historyRange === 'custom' && customHistoryDateRange.start && customHistoryDateRange.end) {
        return new Date(customHistoryDateRange.start + 'T00:00:00Z'); // Use UTC
      }
      return new Date(0);
    })();
    
    // Determine the end date based on range
    const endDate = (() => {
      if (historyRange === 'custom' && customHistoryDateRange.end) {
        return new Date(customHistoryDateRange.end + 'T23:59:59Z'); // Use UTC
      }
      return now;
    })();
    

    // Use UTC for date keys to match backend (which uses UTC day boundaries)
    const keyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    const dayCounts = new Map<string, { date: Date; count: number; avgLenSum: number; lenCount: number; words: string[] }>();
    
    // Track words that have been seen before to only count "new" words
    const seenWords = new Set<string>();
    
    // Sort entries by date to process chronologically
    const sortedEntries = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    sortedEntries.forEach((e) => {
      // Filter entries to only include those within the date range
      if (e.date < start || e.date > endDate) return;
      
      // Only count if this is a "new" word (never seen before)
      if (!seenWords.has(e.word)) {
        seenWords.add(e.word);
        
        const k = keyOf(e.date);
        // Use UTC for date creation to match backend
        if (!dayCounts.has(k)) dayCounts.set(k, { date: new Date(Date.UTC(e.date.getUTCFullYear(), e.date.getUTCMonth(), e.date.getUTCDate())), count: 0, avgLenSum: 0, lenCount: 0, words: [] });
        const rec = dayCounts.get(k)!;
        rec.count += 1;
        rec.avgLenSum += e.word.length;
        rec.lenCount += 1;
        rec.words.push(e.word);
      }
    });
    

    const days: { date: Date; value: number; avgLen?: number; words?: string[] }[] = [];
    const cursor = new Date(start);
    while (cursor <= endDate) {
      const k = keyOf(cursor);
      const rec = dayCounts.get(k);
      days.push({ 
        date: new Date(cursor), 
        value: rec?.count || 0, 
        avgLen: rec && rec.lenCount ? rec.avgLenSum / rec.lenCount : undefined,
        words: rec?.words || []
      });
      // Use UTC for date iteration to match backend
      cursor.setUTCDate(cursor.getUTCDate() + 1);
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
  }, [historyRange, customHistoryDateRange.start, customHistoryDateRange.end]); // Add dependencies for the aggregated function

  // Backend history integration
  const [historyDays, setHistoryDays] = useState<{ date: Date; value: number; avgLen?: number; words?: string[] }[] | null>(null);
  const [sessionWordsDays, setSessionWordsDays] = useState<{ date: Date; value: number; avgLen?: number; words?: string[] }[] | null>(null);
  
  // Load detailed stats (includes sessionHistory) for real data mapping
  type Session = { startTime?: string; timestamp?: string; duration?: number };
  type DetailedStats = {
    sessionHistory?: Session[];
    totalPlayTimeMinutes?: number;
    daysLoggedIn?: number;
    currentStreakDays?: number;
    longestStreakDays?: number;
    lastLoginAt?: string;
  };
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      if (!apiService.isAuthenticated()) return;
      try {
        const res = await apiService.getDetailedStatistics();
        // Accept known keys only
        const ds: DetailedStats = {
          sessionHistory: (res as { sessionHistory?: Session[] })?.sessionHistory || [],
          totalPlayTimeMinutes: (res as { totalPlayTimeMinutes?: number })?.totalPlayTimeMinutes,
          daysLoggedIn: (res as { daysLoggedIn?: number })?.daysLoggedIn,
          currentStreakDays: (res as { currentStreakDays?: number })?.currentStreakDays,
          longestStreakDays: (res as { longestStreakDays?: number })?.longestStreakDays,
          lastLoginAt: (res as { lastLoginAt?: string })?.lastLoginAt,
        };
        setDetailedStats(ds);
      } catch (e) {
        console.error('Failed to load detailed statistics:', e);
      }
    };
    loadDetails();
  }, []);

  // Usage metrics strictly from real data, with fallbacks computed from sessionHistory if needed
  const usageMetrics = React.useMemo(() => {
    // Prefer sessions from time analytics when available (already fetched, server-computed)
    type TAPeriod = { sessions?: { startTime?: string; timestamp?: string; duration?: number }[]; totalPlayTime?: number };
    const ta = (timeAnalytics as unknown as { timePeriods?: Record<string, TAPeriod>; summary?: { totalGamesAcrossPeriods?: number } }) || {};
    const sessionsFromTA: Session[] = ta.timePeriods ? Object.values(ta.timePeriods).flatMap(p => (p?.sessions || []) as Session[]) : [];
    const sh: Session[] = sessionsFromTA.length > 0
      ? sessionsFromTA
      : (detailedStats?.sessionHistory || []);
    const parseTs = (s: Session) => (s?.startTime || s?.timestamp ? new Date((s.startTime || s.timestamp) as string) : null);
    const totalMsFromSessions = (() => {
      if (sessionsFromTA.length && ta.timePeriods) {
        return Object.values(ta.timePeriods).reduce((sum, p) => sum + (p?.totalPlayTime || 0), 0);
      }
      const durationsMs = sh.map(s => (typeof s.duration === 'number' ? s.duration : 0));
      return durationsMs.reduce((a, b) => a + b, 0);
    })();
    const totalMinFromSessions = Math.round(totalMsFromSessions / 60000);
    const gamesFromSessions = ta.summary?.totalGamesAcrossPeriods ?? sh.length;

    // Distinct UTC dates for streaks/days active
    const dayKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    const daySet = new Set<string>();
    sh.forEach(s => { const d = parseTs(s); if (d && !isNaN(d.getTime())) daySet.add(dayKey(d)); });
    const daysActiveFromSessions = daySet.size;

    // Streaks
    const sortedDays = Array.from(daySet).sort();
    let longest = 0; let current = 0;
    if (sortedDays.length) {
      let prev = new Date(sortedDays[0] + 'T00:00:00Z');
      current = 1; longest = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const d = new Date(sortedDays[i] + 'T00:00:00Z');
        const diff = Math.round((d.getTime() - prev.getTime()) / (24*60*60*1000));
        if (diff === 1) { current += 1; } else { current = 1; }
        if (current > longest) longest = current;
        prev = d;
      }
      // Current streak logic: 
      // - If last active day is today → keep current streak
      // - If last active day is yesterday → keep current streak (streak continues until today ends)
      // - If last active day is 2+ days ago → reset to 0
      const todayUTC = new Date();
      const yesterdayUTC = new Date(todayUTC.getTime() - 24*60*60*1000);
      const todayKey = dayKey(todayUTC);
      const yesterdayKey = dayKey(yesterdayUTC);
      const lastKey = sortedDays[sortedDays.length - 1];
      
      if (lastKey !== todayKey && lastKey !== yesterdayKey) {
        current = 0;
      }
    }

    const lastLoginFromSessions = (() => {
      const dates = sh.map(s => parseTs(s)).filter((d): d is Date => !!d && !isNaN(d.getTime()));
      if (!dates.length) return undefined;
      return new Date(Math.max(...dates.map(d => d.getTime())));
    })();

    const totalPlayTimeMinutes = detailedStats?.totalPlayTimeMinutes ?? profile?.totalPlayTimeMinutes ?? totalMinFromSessions ?? undefined;
    const daysLoggedIn = detailedStats?.daysLoggedIn ?? profile?.daysLoggedIn ?? daysActiveFromSessions ?? undefined;
    // Current streak should be based on game sessions, not login dates
    // Only use calculated streak from sessions, don't fall back to login streak
    const currentStreakDays = detailedStats?.currentStreakDays ?? (sortedDays.length ? current : undefined);
    const longestStreakDays = detailedStats?.longestStreakDays ?? (sortedDays.length ? longest : undefined);
    const lastLoginAt = detailedStats?.lastLoginAt ?? profile?.lastLoginAt ?? (lastLoginFromSessions ? lastLoginFromSessions.toISOString() : undefined);
    const avgSessionMinutes = (() => {
      if (totalPlayTimeMinutes && profile?.gamesPlayed) return Math.round(totalPlayTimeMinutes / profile.gamesPlayed);
      if (totalMinFromSessions && gamesFromSessions) return Math.round(totalMinFromSessions / gamesFromSessions);
      return undefined;
    })();

    return { totalPlayTimeMinutes, daysLoggedIn, currentStreakDays, longestStreakDays, lastLoginAt, avgSessionMinutes };
  }, [profile, detailedStats, timeAnalytics]);

  // Calculate history metrics for the selected period - make it reactive to range changes
  const historyMetrics = React.useMemo(() => {
    // Prefer backend history (sourced from dailyStats) when available
    const chartData = historyDays && historyDays.length > 0
      ? historyDays
      : (profile ? aggregated(profile).days : []);
    
    if (chartData && chartData.length > 0) {
      const totalWords = chartData.reduce((sum, day) => sum + day.value, 0);
      const avgPerDay = chartData.length > 0 ? Math.round(totalWords / chartData.length * 10) / 10 : 0;
      const wordsWithLength = chartData.filter(day => day.avgLen !== undefined);
      const avgLength = wordsWithLength.length > 0 
        ? Math.round(wordsWithLength.reduce((sum, day) => sum + (day.avgLen || 0), 0) / wordsWithLength.length * 10) / 10
        : 0;
      
      return { totalWords, avgPerDay, avgLength };
    }
    
    return { totalWords: 0, avgPerDay: 0, avgLength: 0 };
  }, [profile, aggregated, historyDays]);

  useEffect(() => {
    console.log(`🔄 History useEffect triggered: historyRange=${historyRange}`);
    const load = async () => {
      try {
        if (!apiService.isAuthenticated()) return;

        // Map UI range to backend range param
        // NOTE: Backend API seems to only return 7 days regardless of range parameter
        // So we fetch 'all' for ranges > 7d and filter client-side
        const mapRange = (r: typeof historyRange): string => {
          if (r === '7d') return '7d';
          // For all other ranges, fetch 'all' and filter client-side since API doesn't respect range
          return 'all';
        };

        const mappedRange = mapRange(historyRange);
        console.group(`📊 HISTORY GRAPH - Range Changed: ${historyRange.toUpperCase()}`);
        console.log(`API Request: range=${mappedRange} (fetching all data for client-side filtering)`);
        const res = await apiService.getUserHistory({ range: mappedRange });
        console.log(`API Response: ${Array.isArray(res.days) ? res.days.length : 0} days received`);
        const daysFromApi = Array.isArray(res.days) ? res.days.map(d => {
          // Normalize YYYY-MM-DD to local Date without timezone shifting
          const raw = String(d.date);
          let normalized: Date;
          const parts = raw.split('-');
          if (parts.length === 3) {
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const dd = Number(parts[2]);
            normalized = new Date(y, m, dd);
          } else {
            normalized = new Date(raw);
          }
          type HistoryDayApi = { date: string; value: number; avgLen?: number; words?: string[] };
          const dayApi = d as HistoryDayApi;
          const firstTimeWords = Array.isArray(dayApi.words) ? dayApi.words : undefined;
          return {
            date: normalized,
            value: typeof d.value === 'number' ? d.value : 0,
            avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined,
            // Include backend-provided first-time words for tooltips when available
            words: firstTimeWords
          };
        }) : [];
        
        // Reconcile with unique-first aggregation as a fallback when backend doesn't supply words
        const uniqDays = profile ? aggregated(profile).days : [];
        const uniqMap = new Map<string, { value: number; words?: string[] }>();
        uniqDays.forEach(ud => {
          // Use UTC for date keys to match backend
          const k = `${ud.date.getUTCFullYear()}-${String(ud.date.getUTCMonth()+1).padStart(2,'0')}-${String(ud.date.getUTCDate()).padStart(2,'0')}`;
          uniqMap.set(k, { value: ud.value, words: ud.words });
        });
        const reconciled = daysFromApi.map(day => {
          // Use UTC for date keys to match backend
          const k = `${day.date.getUTCFullYear()}-${String(day.date.getUTCMonth()+1).padStart(2,'0')}-${String(day.date.getUTCDate()).padStart(2,'0')}`;
          const uniq = uniqMap.get(k);
          const hasBackendWords = Array.isArray(day.words);
          // Compute avgLen if missing using available words arrays
          const computeAvgLen = (ws?: string[]) => {
            if (!ws || ws.length === 0) return undefined;
            const total = ws.reduce((sum, w) => sum + (w?.length || 0), 0);
            return Math.round((total / ws.length) * 10) / 10;
          };
          const candidateWords = hasBackendWords ? day.words : (uniq?.words);
          const resolvedAvgLen = typeof day.avgLen === 'number' ? day.avgLen : computeAvgLen(candidateWords);
          return {
            ...day,
            value: hasBackendWords ? (day.words?.length || 0) : (uniq?.value ?? day.value),
            words: hasBackendWords ? day.words : (uniq?.words ?? day.words),
            avgLen: resolvedAvgLen,
          };
        });

        const finalDays = reconciled;
        console.log(`After reconciliation: ${finalDays.length} days`);

        // Filter by date range client-side as well (in case backend doesn't respect range)
        let filteredDays = finalDays;
        if (historyRange === 'custom' && customHistoryDateRange.start && customHistoryDateRange.end) {
          const startDate = new Date(customHistoryDateRange.start + 'T00:00:00');
          const endDate = new Date(customHistoryDateRange.end + 'T23:59:59');
          filteredDays = finalDays.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= startDate && dataDate <= endDate;
          });
        } else {
          // Filter by range client-side as fallback
          const now = new Date();
          // Use local time for "today" to match game words history graph (EDT/EST)
          const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const start = (() => {
            const d = new Date(nowStart);
            // Use local date calculations to match game words history
            if (historyRange === '7d') { d.setDate(d.getDate() - 6); return d; }
            if (historyRange === '30d') { d.setDate(d.getDate() - 29); return d; }
            if (historyRange === '90d') { d.setDate(d.getDate() - 89); return d; }
            if (historyRange === '1y') { d.setFullYear(d.getFullYear() - 1); return d; }
            if (historyRange === 'all') return new Date(0);
            return new Date(0);
          })();
          filteredDays = finalDays.filter(d => {
            // Normalize data date to start of day in local time for comparison (to match game words history)
            const dataDate = d.date instanceof Date ? d.date : new Date(d.date);
            const dataDateStart = new Date(dataDate.getFullYear(), dataDate.getMonth(), dataDate.getDate());
            return dataDateStart >= start && dataDateStart <= nowStart;
          });
          console.log(`Client-side filter: ${finalDays.length} → ${filteredDays.length} days`);
          console.log(`Date range: ${start.toISOString().split('T')[0]} to ${nowStart.toISOString().split('T')[0]}`);
          
          // Check if we have enough data to cover the requested range
          const expectedDays = historyRange === '7d' ? 7 : historyRange === '30d' ? 30 : historyRange === '90d' ? 90 : historyRange === '1y' ? 365 : 0;
          const hasEnoughData = filteredDays.length > 0 && (
            historyRange === 'all' || 
            historyRange === 'custom' ||
            (filteredDays[0].date <= start && filteredDays[filteredDays.length - 1].date >= nowStart)
          );
          
          if (!hasEnoughData && expectedDays > 0 && filteredDays.length < expectedDays * 0.5) {
            // API didn't return enough data - fall back to aggregated function
            console.warn(`⚠️ API only returned ${filteredDays.length} days, but need ~${expectedDays} days. Falling back to aggregated profile data...`);
            filteredDays = []; // Set to empty so it falls back to aggregated(profile).days
          }
          
          if (filteredDays.length > 0) {
            console.log(`First date: ${filteredDays[0].date.toISOString().split('T')[0]}, Last date: ${filteredDays[filteredDays.length - 1].date.toISOString().split('T')[0]}`);
          } else if (historyRange !== 'all' && historyRange !== 'custom') {
            console.log(`Using aggregated profile data (will be filtered by aggregated function)`);
          } else {
            console.warn(`⚠️ No data in range! Check if dates are correct.`);
          }
        }
        console.log(`✅ Setting historyDays: ${filteredDays.length} days`);
        console.groupEnd();
        setHistoryDays(filteredDays.length > 0 ? filteredDays : null);
      } catch (error) {
        console.error('❌ History API error:', error);
        console.warn('Falling back to client aggregation');
        console.groupEnd();
        setHistoryDays(null);
      }
    };
    load();
  }, [historyRange, customHistoryDateRange.start, customHistoryDateRange.end, profile, aggregated]);

  // Load session words data
  useEffect(() => {
    console.log(`🔄 Session words useEffect triggered: sessionsRange=${sessionsRange}`);
    const loadSessionWords = async () => {
      try {
        // Check authentication instead of waiting for profile
        if (!apiService.isAuthenticated()) {
          console.log('❌ Not authenticated for session words');
          setSessionWordsDays(null);
          return;
        }

        // Map UI range to backend range param
        // NOTE: Backend API seems to only return 7 days regardless of range parameter
        // So we fetch 'all' for ranges > 7d and filter client-side
        const mapRange = (r: typeof sessionsRange): string => {
          if (r === '7d') return '7d';
          // For all other ranges, fetch 'all' and filter client-side since API doesn't respect range
          return 'all';
        };

        const mappedRange = mapRange(sessionsRange);
        console.group(`🟢 GAMES HISTORY GRAPH - Range Changed: ${sessionsRange.toUpperCase()}`);
        console.log(`API Request: range=${mappedRange} (fetching all data for client-side filtering)`);
        
        const res = await apiService.getUserSessionWords({ range: mappedRange });
        console.log(`API Response: ${Array.isArray(res.days) ? res.days.length : 0} days received`);
        
        const daysFromApi = Array.isArray(res.days) ? res.days.map(d => {
          // If backend sends YYYY-MM-DD, build a local Date without timezone shifts
          const raw = String(d.date);
          let normalized: Date;
          const parts = raw.split('-');
          if (parts.length === 3) {
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const dd = Number(parts[2]);
            // Use UTC for date parsing to match backend
            normalized = new Date(Date.UTC(y, m, dd));
          } else {
            const dt = new Date(d.date);
            // Use UTC for date normalization to match backend
            normalized = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
          }
          const day = {
            date: normalized,
            value: typeof d.value === 'number' ? d.value : 0,
            avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined
          } as { date: Date; value: number; avgLen?: number; words?: string[] };
          return day;
        }) : [];

        // Build per-day session summaries for tooltip (time – words per session)
        try {
          const sessions = (detailedStats?.sessionHistory || []) as { startTime?: string; timestamp?: string; wordsFound?: number; words?: string[]; gamesPlayed?: number }[];
          
          const byDay = new Map<string, { time: string; count: number; games: number }[]>();
          sessions.forEach(s => {
            const start = new Date(s.startTime || s.timestamp || '');
            if (isNaN(start.getTime())) return;
            // Use UTC for date keys to match backend
            const k = `${start.getUTCFullYear()}-${String(start.getUTCMonth()+1).padStart(2,'0')}-${String(start.getUTCDate()).padStart(2,'0')}`;
            const hh = String(start.getUTCHours()).padStart(2, '0');
            const mm = String(start.getUTCMinutes()).padStart(2, '0');
            const count = typeof s.wordsFound === 'number' ? s.wordsFound : (Array.isArray(s.words) ? s.words.length : 0);
            const games = typeof s.gamesPlayed === 'number' ? s.gamesPlayed : 1; // Default to 1 game per session
            const arr = byDay.get(k) || [];
            arr.push({ time: `${hh}:${mm}`, count, games });
            byDay.set(k, arr);
          });
          
          daysFromApi.forEach(day => {
            // Use UTC for date keys to match backend
            const k = `${day.date.getUTCFullYear()}-${String(day.date.getUTCMonth()+1).padStart(2,'0')}-${String(day.date.getUTCDate()).padStart(2,'0')}`;
            const arr = byDay.get(k) || [];
            arr.sort((a,b) => a.time.localeCompare(b.time));
            day.words = arr.length ? arr.map(x => `${x.time} – ${x.count} words, ${x.games} game${x.games > 1 ? 's' : ''}`) : undefined;
          });
        } catch (error) {
          console.error('Error processing session data for tooltip:', error);
        }
        
        console.log(`After processing: ${daysFromApi.length} days`);
        
        // Filter by date range client-side (in case backend doesn't respect range)
        let filteredData = daysFromApi;
        if (sessionsRange === "custom" && customSessionsDateRange.start && customSessionsDateRange.end) {
          const startDate = new Date(customSessionsDateRange.start + 'T00:00:00');
          const endDate = new Date(customSessionsDateRange.end + 'T23:59:59');
          
          filteredData = daysFromApi.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= startDate && dataDate <= endDate;
          });
        } else {
          // Filter by range client-side as fallback
          const now = new Date();
          // Normalize now to start of today in UTC for comparison (to match backend)
          const nowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          const start = (() => {
            const d = new Date(nowStart);
            // Use UTC for date calculations to match backend
            if (sessionsRange === '7d') { d.setUTCDate(d.getUTCDate() - 6); return d; }
            if (sessionsRange === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d; }
            if (sessionsRange === '90d') { d.setUTCDate(d.getUTCDate() - 89); return d; }
            if (sessionsRange === '1y') { d.setUTCFullYear(d.getUTCFullYear() - 1); return d; }
            if (sessionsRange === 'all') return new Date(0);
            return new Date(0);
          })();
          filteredData = daysFromApi.filter(d => {
            // Normalize data date to start of day in UTC for comparison (to match backend)
            const dataDate = d.date instanceof Date ? d.date : new Date(d.date);
            const dataDateStart = new Date(Date.UTC(dataDate.getUTCFullYear(), dataDate.getUTCMonth(), dataDate.getUTCDate()));
            return dataDateStart >= start && dataDateStart <= nowStart;
          });
          console.log(`Client-side filter: ${daysFromApi.length} → ${filteredData.length} days`);
          console.log(`Date range: ${start.toISOString().split('T')[0]} to ${nowStart.toISOString().split('T')[0]}`);
          
          // Check if we have enough data to cover the requested range
          const expectedDays = sessionsRange === '7d' ? 7 : sessionsRange === '30d' ? 30 : sessionsRange === '90d' ? 90 : sessionsRange === '1y' ? 365 : 0;
          const firstDate = filteredData.length > 0 ? filteredData[0].date : null;
          const lastDate = filteredData.length > 0 ? filteredData[filteredData.length - 1].date : null;
          const hasEnoughData = filteredData.length > 0 && (
            sessionsRange === 'all' || 
            sessionsRange === 'custom' ||
            (firstDate && lastDate && firstDate <= start && lastDate >= nowStart)
          );
          
          console.log(`Data check: filteredData.length=${filteredData.length}, expectedDays=${expectedDays}, hasEnoughData=${hasEnoughData}`);
          console.log(`Date range check: firstDate=${firstDate?.toISOString().split('T')[0]}, start=${start.toISOString().split('T')[0]}, lastDate=${lastDate?.toISOString().split('T')[0]}, end=${nowStart.toISOString().split('T')[0]}`);
          
          if (!hasEnoughData && expectedDays > 0 && filteredData.length < expectedDays * 0.5) {
            // API didn't return enough data - build from session history
            console.warn(`⚠️ API only returned ${filteredData.length} days, but need ~${expectedDays} days. Building from session history...`);
            
            // Try to get sessions from detailedStats or timeAnalytics
            let sessions = (detailedStats?.sessionHistory || []) as Array<{ 
              startTime?: string; 
              timestamp?: string; 
              wordsFound?: number;
              words?: string[];
            }>;
            
            // Fallback to timeAnalytics if detailedStats doesn't have session history
            if (sessions.length === 0 && timeAnalytics && (timeAnalytics as Record<string, unknown>).timePeriods) {
              console.log(`Using timeAnalytics as fallback for session history`);
              const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, { sessions?: Array<{ startTime?: string; timestamp?: string; wordsFound?: number; words?: string[] }> }>;
              const allSessions: Array<{ startTime?: string; timestamp?: string; wordsFound?: number; words?: string[] }> = [];
              Object.values(timePeriods).forEach(period => {
                if (period?.sessions && Array.isArray(period.sessions)) {
                  allSessions.push(...period.sessions);
                }
              });
              // Remove duplicates by timestamp
              const uniqueSessions = Array.from(new Map(
                allSessions
                  .filter(s => s.startTime || s.timestamp)
                  .map(s => [s.startTime || s.timestamp || '', s])
              ).values());
              sessions = uniqueSessions;
            }
            
            console.log(`Session history available: ${sessions.length} sessions`);
            
            if (sessions.length > 0) {
              // Build per-day totals from session history
              const dayMap = new Map<string, { date: Date; value: number; words?: string[] }>();
              
              sessions.forEach(s => {
                const sessionTime = s.startTime || s.timestamp;
                if (!sessionTime) return;
                const sessionDate = new Date(sessionTime);
                if (isNaN(sessionDate.getTime())) return;
                
                // Use UTC for date keys to match backend
                const dayKey = `${sessionDate.getUTCFullYear()}-${String(sessionDate.getUTCMonth()+1).padStart(2,'0')}-${String(sessionDate.getUTCDate()).padStart(2,'0')}`;
                const dayDate = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()));
                
                // Check if within range (using UTC dates to match backend)
                const dayDateStart = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate()));
                if (dayDateStart < start || dayDateStart > nowStart) return;
                
                if (!dayMap.has(dayKey)) {
                  dayMap.set(dayKey, { date: dayDate, value: 0, words: [] });
                }
                const day = dayMap.get(dayKey)!;
                const wordCount = typeof s.wordsFound === 'number' ? s.wordsFound : (Array.isArray(s.words) ? s.words.length : 0);
                day.value += wordCount;
              });
              
              // Fill in missing days with 0 values
              const filledDays: Array<{ date: Date; value: number; words?: string[] }> = [];
              const cursor = new Date(start);
              while (cursor <= nowStart) {
                // Use UTC for date keys to match backend
                const dayKey = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth()+1).padStart(2,'0')}-${String(cursor.getUTCDate()).padStart(2,'0')}`;
                const existing = dayMap.get(dayKey);
                filledDays.push(existing || { 
                  date: new Date(cursor), 
                  value: 0,
                  words: []
                });
                // Use UTC for date iteration to match backend
                cursor.setUTCDate(cursor.getUTCDate() + 1);
              }
              
              filteredData = filledDays;
              console.log(`✅ Built ${filteredData.length} days from session history`);
            } else {
              console.warn(`⚠️ No session history available to build data from`);
            }
          } else {
            console.log(`✓ API returned sufficient data (${filteredData.length} days)`);
          }
          
          if (filteredData.length > 0) {
            console.log(`First date: ${filteredData[0].date.toISOString().split('T')[0]}, Last date: ${filteredData[filteredData.length - 1].date.toISOString().split('T')[0]}`);
          } else {
            console.warn(`⚠️ No data in range! Check if dates are correct.`);
          }
        }
        
        console.log(`✅ Setting sessionWordsDays: ${filteredData.length} days`);
        console.groupEnd();
        setSessionWordsDays(filteredData.length > 0 ? filteredData : null);
      } catch (error) {
        console.error('❌ Session words API error:', error);
        console.warn('Falling back to client aggregation');
        console.groupEnd();
        setSessionWordsDays(null);
      }
    };
    loadSessionWords();
  }, [sessionsRange, customSessionsDateRange.start, customSessionsDateRange.end, detailedStats?.sessionHistory, timeAnalytics]);

  // Smart frequency logic for Lexi popup
  const checkLexiPopupVisibility = useCallback(() => {
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('lexiPopupLastShown');
    const lastInteraction = localStorage.getItem('lexiLastInteraction');
    const closeCount = parseInt(localStorage.getItem('lexiPopupCloseCount') || '0');
    const firstVisit = localStorage.getItem('lexiFirstVisit');
    
    // Show popup if:
    // 1. First visit ever (no firstVisit flag)
    // 2. Haven't seen today AND haven't closed it too many times (3+) AND haven't interacted recently (3+ days)
    const shouldShow = !firstVisit || 
                      (lastShown !== today && closeCount < 3 && 
                       (!lastInteraction || (Date.now() - new Date(lastInteraction).getTime()) > (3 * 24 * 60 * 60 * 1000)));
    
    if (shouldShow) {
      setShowLexiPopup(true);
      if (!firstVisit) {
        localStorage.setItem('lexiFirstVisit', 'true');
      }
    }
  }, []);

  const handleLexiPopupClose = useCallback(() => {
    const today = new Date().toDateString();
    const closeCount = parseInt(localStorage.getItem('lexiPopupCloseCount') || '0');
    
    localStorage.setItem('lexiPopupLastShown', today);
    localStorage.setItem('lexiPopupCloseCount', (closeCount + 1).toString());
    setShowLexiPopup(false);
  }, []);

  const handleLexiInteraction = useCallback(() => {
    localStorage.setItem('lexiLastInteraction', new Date().toISOString());
    setShowLexiPopup(false);
  }, []);

  // Auto-hide Lexi popup after 8 seconds
  useEffect(() => {
    if (showLexiPopup) {
      const timer = setTimeout(() => {
        handleLexiPopupClose();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showLexiPopup, handleLexiPopupClose]);

  const fetchProfile = useCallback(async () => {
    try {
      // Data refreshes on mount/route
      
        if (!apiService.isAuthenticated()) {
          router.push("/signin");
          setLoading(false);
          return;
        }

        const userProfile = await apiService.getUserProfile();
        
        // SECURITY: Verify the returned profile matches the authenticated user
        const storedUser = apiService.getStoredUser();
        if (storedUser && userProfile.id !== storedUser.id) {
          console.error('🚨 SECURITY ALERT: Profile ID mismatch!', {
            storedUserId: storedUser.id,
            storedUserEmail: storedUser.email,
            returnedProfileId: userProfile.id,
            returnedProfileEmail: userProfile.email,
            returnedProfileUsername: userProfile.username
          });
          // Clear auth data and redirect to sign in
          await apiService.signOut();
          router.push("/signin");
          setLoading(false);
          setError("Authentication error: Profile mismatch. Please sign in again.");
          return;
        }
        
        console.log('✅ Profile verified:', {
          profileId: userProfile.id,
          profileEmail: userProfile.email,
          profileUsername: userProfile.username,
          matchesStoredUser: storedUser ? userProfile.id === storedUser.id : 'no stored user'
        });
        console.log('Profile data:', userProfile);
        console.log('Profile image URL:', userProfile.profileImageUrl);
        console.log('Selected frame:', userProfile.selectedFrame);
      
      // Debug: Check for the specific words we're looking for
      console.log('=== REFRESH DEBUG ===');
      console.log('Total words found:', userProfile.allFoundWords.length);
      console.log('Words found today:', userProfile.allFoundWords.filter(w => {
        const date = typeof w === 'string' ? undefined : w.date;
        if (date) {
          const foundDate = new Date(date);
          const today = new Date();
          // Use UTC date comparison to match theme word logic
          const foundDateString = foundDate.getUTCFullYear() + '-' + 
            String(foundDate.getUTCMonth() + 1).padStart(2, '0') + '-' + 
            String(foundDate.getUTCDate()).padStart(2, '0');
          const todayString = today.getUTCFullYear() + '-' + 
            String(today.getUTCMonth() + 1).padStart(2, '0') + '-' + 
            String(today.getUTCDate()).padStart(2, '0');
          return foundDateString === todayString;
        }
        return false;
      }).length);
      
      // Check for specific words - handle both UTC and local timezone
      const today = new Date();
      const todayUTC = new Date(today.toISOString().split('T')[0] + 'T00:00:00.000Z');
      const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);
      
      const todayWords = userProfile.allFoundWords.filter(w => {
        const date = typeof w === 'string' ? undefined : w.date;
        if (date) {
          const foundDate = new Date(date);
          // Check if the word was found today in UTC timezone
          return foundDate >= todayUTC && foundDate < tomorrowUTC;
        }
        return false;
      });
      
      console.log('Today\'s words:', todayWords.map(w => {
        const word = typeof w === 'string' ? w : w.word;
        const date = typeof w === 'string' ? undefined : w.date;
        return { word, date };
      }));
      
      // Check for the specific words we're looking for
      const targetWords = ['DUCK', 'GOOSE', 'CRAB', 'HORSE', 'SHEEP'];
      targetWords.forEach(targetWord => {
        const found = userProfile.allFoundWords.some(w => {
          const word = typeof w === 'string' ? w : w.word;
          return word && word.toUpperCase() === targetWord;
        });
        console.log(`"${targetWord}" found in all words:`, found);
      });
      
      console.log('=== END REFRESH DEBUG ===');
      
      setProfile(userProfile);
      setLoading(false);
      
      // Check if should show Lexi popup
      checkLexiPopupVisibility();
    } catch (error) {
        console.error("Profile fetch error:", error);
        setError(error instanceof Error ? error.message : "Failed to load profile");
        if (error instanceof Error && error.message.includes("Authentication failed")) {
          router.push("/signin");
        }
        setLoading(false);
      }
    }, [router, checkLexiPopupVisibility]);

  useEffect(() => {
    fetchProfile();

    const handleVisibilityChange = () => {
      if (!document.hidden && apiService.isAuthenticated()) {
        fetchProfile();
      }
    };

    // Listen for stats updates from game page (immediate refresh, no delay)
    // Use debouncing to prevent rapid-fire requests if multiple games completed quickly
    const handleStatsUpdate = () => {
      console.log('📊 Stats updated event received - refreshing profile');
      if (apiService.isAuthenticated()) {
        // Clear any pending refresh
        if (statsUpdateTimeoutRef.current) {
          clearTimeout(statsUpdateTimeoutRef.current);
        }
        // Debounce: Wait 500ms to batch multiple rapid updates, then refresh
        // This prevents excessive API calls if user plays multiple games quickly
        // Use cache-busting to bypass API Gateway cache for fresh data
        statsUpdateTimeoutRef.current = setTimeout(async () => {
          try {
            if (!apiService.isAuthenticated()) {
              return;
            }
            // Fetch fresh profile data
            const userProfile = await apiService.getUserProfile();
            
            // SECURITY: Verify the returned profile matches the authenticated user
            const storedUser = apiService.getStoredUser();
            if (storedUser && userProfile.id !== storedUser.id) {
              console.error('🚨 SECURITY ALERT: Profile ID mismatch in stats update!', {
                storedUserId: storedUser.id,
                storedUserEmail: storedUser.email,
                returnedProfileId: userProfile.id,
                returnedProfileEmail: userProfile.email
              });
              // Clear auth data and redirect to sign in
              await apiService.signOut();
              router.push("/signin");
              return;
            }
            
            setProfile(userProfile);
            setLoading(false);
            checkLexiPopupVisibility();
          } catch (error) {
            console.error("Profile fetch error (stats update):", error);
            setError(error instanceof Error ? error.message : "Failed to load profile");
            if (error instanceof Error && error.message.includes("Authentication failed")) {
              router.push("/signin");
            }
            setLoading(false);
          }
          statsUpdateTimeoutRef.current = null;
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('wordflect-stats-updated', handleStatsUpdate);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('wordflect-stats-updated', handleStatsUpdate);
      // Clean up debounce timer
      if (statsUpdateTimeoutRef.current) {
        clearTimeout(statsUpdateTimeoutRef.current);
        statsUpdateTimeoutRef.current = null;
      }
    };
  }, [router, fetchProfile]);
  
  // Fetch currency history function - trigger Vercel deployment
  const fetchCurrencyHistory = useCallback(async (type: 'flectcoins' | 'gems') => {
    console.log('💰 Fetching currency history for type:', type);
    setIsLoadingCurrencyHistory(true);
    try {
      // TODO: getCurrencyHistory not yet implemented in apiService
      // const data = await apiService.getCurrencyHistory(type, 100);
      setCurrencyHistory(null);
      console.log('💰 Currency history: Not yet implemented');
    } catch (error) {
      console.error('❌ Failed to fetch currency history:', error);
      setCurrencyHistory(null);
    } finally {
      setIsLoadingCurrencyHistory(false);
    }
  }, []);

  // Load flectcoins history on mount to enable mission completion tracking in Activity Snapshot
  useEffect(() => {
    if (profile && apiService.isAuthenticated() && !currencyHistory) {
      fetchCurrencyHistory('flectcoins').catch(err => {
        console.error('Failed to load currency history for Activity Snapshot:', err);
      });
    }
  }, [profile, currencyHistory, fetchCurrencyHistory]);
  
  // Generate time analytics from existing data
  useEffect(() => {
    console.log('🔄 Time analytics useEffect triggered, profile:', !!profile);
    
    const fetchTimeAnalytics = async () => {
      if (!profile) {
        console.log('❌ No profile available for time analytics');
        setTimeAnalytics(null);
        return;
      }

      console.log('🎯 Starting time analytics fetch for profile:', profile.id);

      try {
        console.log('🎯 Fetching time analytics from backend API...');
        console.log('🔐 Is authenticated:', apiService.isAuthenticated());
        console.log('🔐 Token expired:', apiService.isTokenExpired());
        
        // Always fetch "All Time" data
        const filters = { period: 'ALL' };
        
        console.log('🎯 Fetching time analytics (All Time):', filters);
        const response = await apiService.getTimeAnalytics(filters);
        console.log('✅ Backend time analytics response:', response);
        console.log('✅ Response type:', typeof response);
        console.log('✅ Response keys:', response ? Object.keys(response as Record<string, unknown>) : 'null');
        
        // Handle both response structures: { analytics: {...} } or direct analytics object
        let analytics: Record<string, unknown> | null = null;
        
        if (response) {
          const responseObj = response as Record<string, unknown>;
          // Check if response has an 'analytics' property
          if (responseObj.analytics) {
            analytics = responseObj.analytics as Record<string, unknown>;
            console.log('📊 Found analytics in response.analytics');
          } else if (responseObj.timePeriods) {
            // Response is the analytics object directly
            analytics = responseObj;
            console.log('📊 Found analytics as direct response (has timePeriods)');
          } else {
            console.warn('⚠️ Response structure unexpected:', responseObj);
          }
        }
        
        if (analytics) {
          console.log('📊 Time analytics data from backend:', analytics);
          console.log('📊 Time periods structure:', analytics.timePeriods);
          console.log('📊 Time periods keys:', Object.keys(analytics.timePeriods || {}));
          if (analytics.timePeriods) {
            Object.entries(analytics.timePeriods as Record<string, unknown>).forEach(([period, data]) => {
              const periodData = data as Record<string, unknown>;
              console.log(`📊 ${period}:`, periodData);
              console.log(`📊 ${period} gamesPlayed:`, periodData?.gamesPlayed);
              console.log(`📊 ${period} wordCount:`, periodData?.wordCount);
              console.log(`📊 ${period} sessions count:`, Array.isArray(periodData?.sessions) ? periodData.sessions.length : 0);
            });
          }
          console.log('🔄 Setting timeAnalytics state with All Time data');
          setTimeAnalytics(analytics);
        } else {
          console.warn('⚠️ No analytics data found in response');
          console.log('⚠️ Full response structure:', JSON.stringify(response, null, 2));
          setTimeAnalytics(null);
        }
      } catch (error) {
        console.error('❌ Error fetching time analytics from backend:', error);
        console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
        
        // Don't sign out the user for time analytics failures - just show no data
        if (error instanceof Error && error.message.includes('Authentication failed')) {
          console.log('🔐 Time analytics auth failed - user may need to refresh token, but keeping them signed in');
        } else if (error instanceof Error && error.message.includes('Access denied')) {
          console.log('🚫 Time analytics access denied - user may not have permission');
        } else {
          console.log('❓ Unknown time analytics error:', error);
        }
        
        setTimeAnalytics(null);
      }
    };

    if (profile) {
      console.log('🎯 Profile available, calling fetchTimeAnalytics');
      fetchTimeAnalytics();
    } else {
      console.log('❌ No profile, skipping time analytics fetch');
    }
  }, [profile]);

  // Refresh time analytics periodically and on tab focus
  useEffect(() => {
    if (!profile) return;

    const refresh = async () => {
      try {
        console.log('🔄 Auto-refreshing time analytics data (All Time)...');
        // Always use "All Time" data
        const filters = { period: 'ALL' };
        
        const response = await apiService.getTimeAnalytics(filters);
        if (response && (response as Record<string, unknown>).analytics) {
          const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
          setTimeAnalytics(analytics);
          console.log('✅ Time analytics data refreshed');
        }
      } catch (error) {
        console.error('❌ Error refreshing time analytics:', error);
      }
    };

    const interval = setInterval(refresh, 5000); // 5 seconds - reduced for faster session updates
    const onFocus = () => {
      console.log('🔎 Tab focused — refreshing time analytics');
      refresh();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [profile]);

  // Fetch theme analytics from backend API
  useEffect(() => {
    const fetchThemeAnalytics = async () => {
      if (!profile) {
        console.log('❌ No profile available for theme analytics');
        setThemeAnalytics(null);
        return;
      }

      try {
        console.log('🎯 Fetching theme analytics from backend API...');
        console.log('🔐 User profile:', profile);
        console.log('🔐 Is authenticated:', apiService.isAuthenticated());
        console.log('🔐 Token expired:', apiService.isTokenExpired());
        
        // Always start with an object so week augmentation runs even if the main endpoint fails
        let analytics: Record<string, unknown> = {} as Record<string, unknown>;
        try {
          const response = await apiService.getThemeAnalytics();
          console.log('✅ Backend theme analytics response:', response);
          
          // Handle backend response structure
          if (response && (response as Record<string, unknown>).analytics) {
            analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
            console.log('📊 Theme analytics data from backend:', analytics);
          } else {
            console.warn('⚠️ No analytics data in backend response');
            console.log('📊 Full response structure:', response);
          }
        } catch (innerError) {
          console.warn('⚠️ Theme analytics main endpoint failed, proceeding with week augmentation only:', innerError);
        }

        // Show cards with "tap to load" - no auto-population
        console.log('🎯 Showing cards with tap to load');
        setThemeAnalytics({} as Record<string, unknown>);
        setIsLoadingThemeAnalytics(false);
        console.log('🎯 Cards ready for tap to load');
      } catch (error) {
        console.error('❌ Error fetching theme analytics from backend:', error);
        console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
        // Ensure state becomes a non-null object to allow UI to render augmented week data
        setThemeAnalytics({} as Record<string, unknown>);
      }
    };

    if (profile) {
      fetchThemeAnalytics();
    }
  }, [profile]);


  const handleSignOut = async () => {
    await apiService.signOut();
    router.push("/");
  };

  const handleAiQuery = (callback?: (response: string) => void, queryText?: string) => {
    const currentQuery = queryText || aiQuery;
    console.log('handleAiQuery called with query:', currentQuery);
    if (!currentQuery.trim() || !profile) {
      console.log('Early return: no query or profile');
      return;
    }
    
    const query = currentQuery.toLowerCase();
    console.log('Processing query:', query);
    let response = '';
    
    // --- Intent helpers ---
    const getUtcDayStart = (d: Date) => new Date(d.toISOString().split('T')[0] + 'T00:00:00.000Z');
    type TimeLabel = 'today' | 'yesterday' | 'thisweek' | 'lastweek' | 'thismonth' | 'lastmonth';
    const getUtcRange = (label: TimeLabel) => {
      const now = new Date();
      const todayStart = getUtcDayStart(now);
      if (label === 'today') return { start: todayStart, end: new Date(todayStart.getTime() + 86400000) };
      if (label === 'yesterday') {
        const y = new Date(todayStart.getTime() - 86400000);
        return { start: y, end: todayStart };
      }
      if (label === 'thisweek') {
        const day = todayStart.getUTCDay(); // 0=Sun
        const weekStart = new Date(todayStart.getTime() - day * 86400000);
        return { start: weekStart, end: new Date(weekStart.getTime() + 7 * 86400000) };
      }
      if (label === 'lastweek') {
        const day = todayStart.getUTCDay();
        const thisWeekStart = new Date(todayStart.getTime() - day * 86400000);
        const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
        return { start: lastWeekStart, end: thisWeekStart };
      }
      if (label === 'thismonth') {
        const start = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1));
        const end = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() + 1, 1));
        return { start, end };
      }
      if (label === 'lastmonth') {
        const start = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - 1, 1));
        const end = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1));
        return { start, end };
      }
      return { start: todayStart, end: new Date(todayStart.getTime() + 86400000) };
    };
    const containsAny = (s: string, arr: string[]) => arr.some(k => s.includes(k));
    const timeIntent = () => {
      if (containsAny(query, ['today'])) return 'today';
      if (containsAny(query, ['yesterday'])) return 'yesterday';
      if (containsAny(query, ['this week', 'thisweek'])) return 'thisweek';
      if (containsAny(query, ['last week', 'lastweek'])) return 'lastweek';
      if (containsAny(query, ['this month', 'thismonth'])) return 'thismonth';
      if (containsAny(query, ['last month', 'lastmonth'])) return 'lastmonth';
      return null;
    };
    
    // === GAMEPLAY HELP & TIPS ===
    if (query.includes('how to play') || query.includes('how do i play') || query.includes('rules')) {
      response = `WordFlect is a fun word puzzle game! Here's how it works:

Your goal is to find as many words as possible from a 4x4 letter grid. Words must be at least 3 letters long, and you can use adjacent letters including diagonals. Each letter can only be used once per word, and no proper nouns or abbreviations are allowed.

Here are some helpful tips: look for common prefixes and suffixes, start with longer words for more points, use your timer wisely, and complete daily themes for bonus rewards!

Premium subscribers get exclusive themes, bonus gems, and priority support!`;
    }
    
    else if (query.includes('scoring') || query.includes('points') || query.includes('how to score')) {
      response = `Here's how scoring works in WordFlect:

🎯 **Letter-Based Scoring** (Scrabble-style):
• Common letters (A, E, I, O, U, L, N, S, T, R): 2 points each
• Medium letters (D, G): 4 points each  
• Hard letters (B, C, M, P): 6 points each
• Challenging letters (F, H, V, W, Y): 8 points each
• Difficult letters (K): 10 points each
• Rare letters (J, X): 16 points each
• Very rare letters (Q, Z): 20 points each

📏 **Word Length Bonus**: +2 points per letter (encourages longer words)

🎨 **Theme Word Bonus**: Theme words get additional bonus points based on the theme's multiplier

📊 **Example**: "CAT" = C(6) + A(2) + T(2) + length bonus(6) = 16 points + theme bonus

You currently have ${profile.points.toLocaleString()} total points and ${profile.gems.toLocaleString()} gems!`;
    }
    
    else if (query.includes('daily theme') || query.includes('theme words') || query.includes('daily challenge')) {
      const currentTheme = themeAnalytics?.currentTheme || 'Unknown';
      const themeProgress = themeAnalytics?.themeProgress as { found?: number; total?: number } | undefined;
      response = `Daily Theme System:

🎨 **Today's Theme**: ${currentTheme}
📈 **Your Progress**: ${themeProgress?.found || 0}/${themeProgress?.total || 0} words found

💡 **Benefits**:
• Theme words give 2x points
• Complete themes for bonus gems
• New theme every day at midnight UTC
• Track your progress in analytics

🎯 **Tip**: Focus on finding theme words first, then explore other words!`;
    }
    
    // Words found today (UTC-aligned with missions/themes/time analytics)
    else if ((query.includes('how many') || query.includes('count')) && query.includes('word')) {
      // Words in a time period (UTC). Default to today if time phrase present; otherwise total unique words overall
      const t = timeIntent();
      if (t) {
        const { start, end } = getUtcRange(t as TimeLabel);
        const inRange = profile.allFoundWords.filter(w => {
          const dateStr = typeof w === 'string' ? undefined : w.date;
          if (!dateStr) return false;
          const foundDate = new Date(dateStr);
          return foundDate >= start && foundDate < end;
        });
        const count = inRange.length;
        response = `You've found ${count} word${count === 1 ? '' : 's'} ${t.replace('this', 'this ').replace('last','last ')} (UTC).`;
      } else {
        const total = profile.allFoundWords.length;
        response = `You've found ${total} words overall.`;
      }
    }

    // Games played today (UTC): derive from sessionHistory if available
    else if ((query.includes('how many') || query.includes('count')) && (query.includes('game') || query.includes('games') || query.includes('session') || query.includes('sessions'))) {
      // Games (sessions) in a time period from sessionHistory; default to overall total
      const sessions = (detailedStats?.sessionHistory || []) as Array<{ startTime?: string; timestamp?: string; sessionId?: string }>; 
      const t = timeIntent();
      if (t) {
        const { start, end } = getUtcRange(t as TimeLabel);
        const uniq = new Set<string>();
        sessions.forEach(s => {
          const ts = s.startTime || s.timestamp;
          if (!ts) return;
          const d = new Date(ts);
          if (d >= start && d < end) {
            const key = s.sessionId || d.toISOString();
            uniq.add(key);
          }
        });
        const count = uniq.size;
        const noun = (query.includes('session') || query.includes('sessions')) ? 'session' : 'game';
        response = `You've played ${count} ${noun}${count === 1 ? '' : 's'} ${t.replace('this', 'this ').replace('last','last ')} (UTC).`;
      } else {
        const noun = (query.includes('session') || query.includes('sessions')) ? 'sessions' : 'games';
        response = `You've played ${profile.gamesPlayed?.toLocaleString?.() || profile.gamesPlayed || 0} ${noun} overall.`;
      }
    }
    
    else if (query.includes('missions') || query.includes('daily mission') || query.includes('weekly mission')) {
      const dailyProgress = (profile as { missions?: { daily?: { progress?: number; target?: number } } }).missions?.daily;
      const weeklyProgress = (profile as { missions?: { weekly?: { progress?: number; target?: number } } }).missions?.weekly;
      response = `Mission System:

📅 **Daily Missions**: 
• Progress: ${dailyProgress?.progress || 0}/${dailyProgress?.target || 0}
• Reset: Every day at midnight UTC
• Rewards: Gems and Flectcoins

📊 **Weekly Missions**:
• Progress: ${weeklyProgress?.progress || 0}/${weeklyProgress?.target || 0}  
• Reset: Every Sunday at midnight UTC
• Rewards: Premium rewards

🎯 **Global Missions**: Long-term achievements with special rewards!`;
    }
    
    else if (query.includes('battles') || query.includes('how to battle') || query.includes('multiplayer')) {
      response = `Battle System:

⚔️ **How Battles Work**:
• Challenge friends or random opponents
• Both players get the same word grid
• Find words within the time limit
• Highest score wins!

📊 **Your Battle Stats**: 
• Wins: ${profile.battleWins || 0}
• Losses: ${profile.battleLosses || 0}
• Win Rate: ${profile.battleWins && profile.battleLosses ? Math.round((profile.battleWins / (profile.battleWins + profile.battleLosses)) * 100) : 0}%

💡 **Battle Tips**:
• Practice with daily games first
• Focus on longer, higher-scoring words
• Use your best strategies
• Challenge players of similar skill level!`;
    }
    
    else if (query.includes('tips') || query.includes('strategy') || query.includes('how to improve')) {
      response = `Pro Tips for WordFlect:

🧠 **Word Finding Strategy**:
• Scan for common word patterns (ING, TION, ER, ED)
• Look for prefixes (UN, RE, PRE) and suffixes (LY, EST, FUL)
• Start with longer words for more points
• Use the timer wisely - don't rush!

🎯 **Scoring Optimization**:
• Daily theme words = 2x points
• Longer words = more points
• Perfect games = bonus gems
• Maintain daily streaks for rewards

📈 **Improvement**:
• Play daily games regularly to improve
• Complete missions for rewards
• Practice with different letter combinations
• Learn from your analytics!`;
    }
    
    else if (query.includes('analytics') || query.includes('stats') || query.includes('performance')) {
      const totalTime = (timeAnalytics?.summary as { totalPlayTimeFormatted?: string })?.totalPlayTimeFormatted || '0m 0s';
      const peakPeriod = (timeAnalytics?.summary as { peakPeriod?: string })?.peakPeriod || 'Unknown';
      response = `Your Performance Analytics:

⏰ **Play Patterns**:
• Total Play Time: ${totalTime}
• Peak Playing Time: ${peakPeriod}
• Games Played: ${profile.gamesPlayed}
• Words Found: ${profile.allFoundWords?.length || 0}

📊 **Time Analytics**:
• Your most active time period: ${peakPeriod}
• Total words across all periods: ${(timeAnalytics?.summary as { totalWordsAcrossPeriods?: number })?.totalWordsAcrossPeriods || 0}
• Average session length: ${usageMetrics.avgSessionMinutes || 0} minutes

🎯 **Improvement Areas**:
• Try playing during your peak time: ${peakPeriod}
• Focus on longer words for higher scores
• Complete daily themes for bonus points!

💎 **Premium Analytics**: Upgrade to Premium for advanced analytics, trend analysis, and personalized insights!`;
    }
    
    // === NAVIGATION & ACTIONS ===
    else if (query.includes('dashboard') || query.includes('go to dashboard') || query.includes('navigate to dashboard')) {
      response = `I&apos;ll take you to your dashboard right now!`;
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    }
    else if (query.includes('sign out') || query.includes('logout') || query.includes('log out') || query.includes('sign me out')) {
      response = `I&apos;ll sign you out now. Thanks for playing WordFlect!`;
      // Sign out the user
      setTimeout(() => {
        handleSignOut();
      }, 1000);
    }
    else if (query.includes('open app') || query.includes('launch app') || query.includes('open wordflect app') || query.includes('play game') || query.includes('start game')) {
      response = `I&apos;ll try to open the WordFlect app for you!`;
      // Try to open the mobile app
      setTimeout(() => {
        // Try deep link first (for iOS/Android)
        const deepLink = 'wordflect://open';
        
        // Create a hidden iframe to attempt deep link
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);
        
        // Remove iframe after attempt
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
        
        // Fallback: try to redirect to app store or web version
        setTimeout(() => {
          // Check if we're on mobile
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          if (isMobile) {
            // Try to open app store
            window.open('https://apps.apple.com/app/wordflect', '_blank');
          } else {
            // Desktop - redirect to web version or show message
            window.open('https://wordflect.com', '_blank');
          }
        }, 2000);
      }, 1000);
    }
    
    // === FRAMES & CUSTOMIZATION ===
    else if (query.includes('frames') || query.includes('customize') || query.includes('profile') || query.includes('avatar')) {
      response = `Frames & Customization:

🎨 **Current Frame**: ${(profile as { selectedFrame?: string }).selectedFrame || 'Default Frame'}
💰 **Your Flectcoins**: ${profile.flectcoins.toLocaleString()}

🖼️ **Frame System**:
• Unlock frames by playing games and completing missions
• Each frame has unique visual effects and animations
• Premium frames available for Flectcoins or gems
• Change frames anytime in your profile

💎 **Premium Frames**:
• Exclusive animated frames
• Special effects and particles
• Limited edition seasonal frames
• Premium subscribers get 50% off all frames!

🎯 **How to Change Frames**:
1. Go to your Profile
2. Tap "Select Frame"
3. Choose from unlocked frames
4. Preview before purchasing

💡 **Pro Tip**: Premium subscribers get exclusive frames and early access to new releases!`;
    }
    
    // === CUSTOM BACKGROUNDS ===
    else if (query.includes('background') || query.includes('backgrounds') || query.includes('custom background')) {
      response = `Custom Backgrounds:

🖼️ **Background System**:
• Choose from 20+ unique backgrounds
• Unlock backgrounds by completing missions
• Premium backgrounds available for gems
• Change backgrounds anytime in settings

🎨 **Background Categories**:
• Nature themes (forest, ocean, mountains)
• Abstract patterns (geometric, artistic)
• Seasonal themes (winter, spring, summer, fall)
• Special event backgrounds (holidays, celebrations)

💎 **Premium Backgrounds**:
• Exclusive animated backgrounds
• Interactive particle effects
• Limited edition seasonal backgrounds
• Premium subscribers get 50% off all backgrounds!

🎯 **How to Change Backgrounds**:
1. Go to Settings
2. Tap "Customize Background"
3. Browse available backgrounds
4. Preview before purchasing
5. Apply your selection

💡 **Pro Tip**: Premium subscribers get exclusive animated backgrounds and early access to new releases!`;
    }
    
    // === FONT CUSTOMIZATION ===
    else if (query.includes('font') || query.includes('text color') || query.includes('color') || query.includes('typography')) {
      response = `Font & Text Customization:

🎨 **Font System**:
• Choose from 15+ unique font styles
• Customize text colors for different elements
• Adjust font sizes for accessibility
• Preview changes before applying

🌈 **Color Customization**:
• Primary text color (main game text)
• Secondary text color (UI elements)
• Accent color (highlights and buttons)
• Background text color (overlays)

📝 **Font Options**:
• Classic serif fonts (elegant, traditional)
• Modern sans-serif fonts (clean, minimal)
• Decorative fonts (fun, playful)
• Accessibility fonts (dyslexia-friendly)

💎 **Premium Fonts**:
• Exclusive premium font styles
• Advanced color customization
• Font size presets for different needs
• Premium subscribers get 50% off all fonts!

🎯 **How to Customize Fonts**:
1. Go to Settings
2. Tap "Font & Colors"
3. Choose your font style
4. Select text colors
5. Adjust font size
6. Preview and apply

💡 **Pro Tip**: Premium subscribers get exclusive fonts and advanced color customization options!`;
    }
    
    // === SUBSCRIPTION & PREMIUM FEATURES ===
    else if (query.includes('premium') || query.includes('subscription') || query.includes('upgrade') || query.includes('pro')) {
      const isPremium = (profile as { isPremium?: boolean }).isPremium || false;
      response = `Premium Subscription:

${isPremium ? '🎉 **You are a Premium subscriber!**' : '💎 **Upgrade to Premium for exclusive benefits!**'}
⭐ **Premium Features**:
• Unlimited daily games (vs 3 for free users)
• Exclusive daily themes and word sets
• 2x gems and Flectcoins from all activities
• Priority customer support
• Advanced analytics and insights
• Exclusive frames and customization
• Ad-free experience
• Early access to new features

💰 **Pricing**:
• Basic: $1.99/month
• Premium: $3.99/month (Most Popular!)
• Pro: $5.99/month
• Annual: $19.99, $39.99, $59.99 respectively (17% savings!)

🎯 **Value Proposition**:
• Save 2+ hours per month with unlimited games
• Earn 2x rewards worth $10+ monthly
• Exclusive content worth $15+ monthly
• Total value: $25+ monthly for just $3.99!

💡 **Why Premium?**: Premium users find 3x more words, earn 2x more rewards, and get exclusive content that free users miss out on!`;
    }
    
    // === PAYMENT & PURCHASES ===
    else if (query.includes('purchase') || query.includes('buy') || query.includes('payment') || query.includes('billing')) {
      response = `Payment & Purchases:

💳 **Payment Methods**:
• Credit/Debit Cards (Visa, MasterCard, American Express)
• PayPal
• Apple Pay (iOS)
• Google Pay (Android)
• Cryptocurrency (Bitcoin, Ethereum)

💰 **In-App Purchases**:
• Flectcoins: $0.99 - $19.99
• Gems: $1.99 - $49.99
• Premium Frames: $2.99 - $9.99
• Premium Subscription: $3.99/month

🔒 **Security**:
• All payments processed securely
• No payment data stored on our servers
• PCI DSS compliant
• 256-bit SSL encryption

💎 **Premium Value**:
• Monthly subscription costs less than a coffee
• Annual subscription saves you $6-12/year
• Lifetime option pays for itself in 2 years
• Cancel anytime with no penalties

🎯 **Best Value**: Annual Premium subscription gives you the most bang for your buck!`;
    }
    
    // === GAME FEATURES & MECHANICS ===
    else if (query.includes('features') || query.includes('what can i do') || query.includes('game features')) {
      response = `WordFlect Game Features:

🎮 **Core Features**:
• Daily word puzzles with unique grids
• Daily themes with bonus rewards
• Mission system (Daily, Weekly, Global)
• Battle system for multiplayer competition
• Leaderboards and rankings
• Achievement system
• Progress tracking and analytics

🏆 **Rewards System**:
• Flectcoins for in-game purchases
• Gems for premium content
• Experience points for leveling up
• Streak bonuses for daily play
• Mission completion rewards

🎨 **Customization**:
• Multiple frame options
• Profile customization
• Achievement badges
• Progress tracking
• Personal statistics

💎 **Premium Features**:
• Unlimited daily games
• Exclusive themes and content
• 2x rewards and bonuses
• Advanced analytics
• Priority support
• Ad-free experience

🎯 **Social Features**:
• Friend battles and challenges
• Leaderboard competitions
• Achievement sharing
• Progress comparison

💡 **Pro Tip**: Premium subscribers get access to all features and exclusive content!`;
    }
    
    // === POWER-UPS & GAME MECHANICS ===
    else if (query.includes('power') || query.includes('powerup') || query.includes('power-up') || query.includes('boost') || query.includes('advantage')) {
      response = `Power-ups & Game Advantages:

⚡ **Power-up Types**:
• **Word Hint**: Reveal one letter in a word you're struggling with
• **Bonus Points**: Double points for your next 3 words found
• **Letter Reveal**: Show all possible next letters for current word
• **Streak Protection**: Prevent streak loss for one day
• **Word Boost**: Increase word length bonus for one game

💰 **How to Get Power-ups**:
• Purchase with Flectcoins (50-200 Flectcoins each)
• Buy with Gems (1-5 gems for premium power-ups)
• Earn as mission rewards
• Win in battle tournaments
• Daily login bonuses

🎮 **Strategic Use**:
• Save power-ups for difficult daily themes
• Use during battle matches for competitive advantage
• Combine power-ups for maximum effect
• Time your power-ups with high-scoring opportunities

💎 **Premium Power-ups**:
• Exclusive power-ups only available to premium subscribers
• 50% discount on all power-up purchases
• Special battle power-ups for competitive play
• Early access to new power-up types

💡 **Pro Tip**: Smart power-up usage can significantly boost your scores and win rates!`;
    }
    
    // === HELP & SUPPORT ===
    else if (query.includes('help') || query.includes('support') || query.includes('contact') || query.includes('problem')) {
      response = `Help & Support:

🆘 **Getting Help**:
• Check this AI assistant for instant answers
• Browse our comprehensive help center
• Contact support via in-app messaging
• Join our community Discord server

📞 **Support Channels**:
• In-app support (24/7)
• Email: support@wordflect.com
• Discord community
• Social media support
💎 **Premium Support**:
• Priority support queue
• Direct access to developers
• Advanced troubleshooting
• Feature request priority

🔧 **Common Issues**:
• Game not loading: Check internet connection
• Progress not saving: Ensure you're logged in
• Payment issues: Contact support immediately
• Account problems: Use account recovery

🎯 **Quick Solutions**:
• Restart the app for most issues
• Clear cache if experiencing lag
• Update to latest version
• Check device compatibility

💡 **Pro Tip**: Premium subscribers get priority support and direct developer access!`;
    }
    
    // === LEADERBOARDS & COMPETITION ===
    else if (query.includes('leaderboard') || query.includes('ranking') || query.includes('competition') || query.includes('top players')) {
      response = `Leaderboards & Competition:

🏆 **Leaderboard Types**:
• Daily leaderboards (resets daily)
• Weekly leaderboards (resets Sunday)
• Monthly leaderboards (resets monthly)
• All-time leaderboards
• Friend leaderboards

📊 **Ranking Factors**:
• Total words found
• High scores
• Win rate in battles
• Streak length
• Mission completion

🎯 **Your Rankings**:
• Current level: ${profile.highestLevel || 1}
• Total games: ${profile.gamesPlayed}
• High score: ${profile.topScore?.toLocaleString() || 0}
• Battle wins: ${profile.battleWins || 0}

💎 **Premium Advantages**:
• Exclusive leaderboard categories
• Advanced ranking statistics
• Detailed performance analysis
• Competitive edge with unlimited games

🎮 **Competition Tips**:
• Play daily for consistent ranking
• Focus on high-scoring words
• Complete missions for bonus points
• Battle other players for extra rewards

💡 **Pro Tip**: Premium subscribers get exclusive leaderboard categories and advanced statistics!`;
    }
    
    // === PERSONAL STATS (existing functionality) ===
    else if (query.includes('words') || query.includes('word')) {
      const totalWords = profile.allFoundWords.length;
      response = `You have found ${totalWords.toLocaleString()} words total!

💎 **Premium Tip**: Premium subscribers find 3x more words with unlimited daily games and exclusive themes!`;
    } else if (query.includes('level') || query.includes('levels')) {
      response = `You are currently at Level ${profile.highestLevel}!

💎 **Premium Advantage**: Premium subscribers level up 2x faster with bonus experience points!`;
    } else if (query.includes('win') || query.includes('rate') || query.includes('percentage')) {
      const rate = winRate(profile);
      response = `Your win rate is ${rate}% (${profile.battleWins} wins, ${profile.battleLosses} losses).

💎 **Premium Edge**: Premium subscribers get exclusive battle strategies and advanced analytics to improve their win rate!`;
    } else if (query.includes('games') || query.includes('played')) {
      response = `You have played ${profile.gamesPlayed} games total.

💎 **Premium Benefit**: Premium subscribers get unlimited daily games (vs 3 for free users) - that's 10x more games per day!`;
    } else if (query.includes('coins') || query.includes('flectcoins')) {
      response = `You have ${profile.flectcoins.toLocaleString()} Flectcoins!

Flectcoins are your in-game currency that you earn by playing games and completing missions. You use them exclusively to purchase power-ups that give you advantages during gameplay.

You can earn Flectcoins by playing daily games, where you typically get 10 to 50 Flectcoins per game, completing daily missions for bonus rewards, winning battles against other players, and maintaining daily streaks.

Use your Flectcoins to buy power-ups that enhance your word-finding abilities and give you strategic advantages during games.

Premium subscribers earn double Flectcoins from all activities, so they get twice the rewards!`;
    } else if (query.includes('points')) {
      response = `You have ${profile.points.toLocaleString()} points!
💎 **Premium Multiplier**: Premium subscribers earn 2x points from all activities and get exclusive high-scoring themes!`;
    } else if (query.includes('gems')) {
      response = `You have ${profile.gems.toLocaleString()} gems!

💎 **What are Gems?**:
• Premium currency for high-value purchases
• Used to buy exclusive frames, backgrounds, and power-ups
• More valuable than Flectcoins (1 gem = 100 Flectcoins)

🎮 **How to Earn Gems**:
• Complete weekly missions (bonus gems)
• Win battle tournaments
• Achieve perfect games (no mistakes)
• Maintain long daily streaks
• Premium subscribers earn 2x gems from all activities

🛒 **How to Spend Gems**:
• Purchase exclusive animated frames
• Buy premium backgrounds with effects
• Unlock special power-ups and boosts
• Get early access to new features
• Customize your profile appearance

💎 **Premium Rewards**: Premium subscribers earn 2x gems from all activities and get exclusive gem-only content!`;
    } else if (query.includes('battles') || query.includes('battle')) {
      response = `You have ${profile.battleWins} battle wins and ${profile.battleLosses} battle losses.

💎 **Premium Battles**: Premium subscribers get exclusive battle modes, advanced strategies, and priority matchmaking!`;
    } else if (query.includes('time') || query.includes('play time')) {
      const totalMinutes = usageMetrics.totalPlayTimeMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      response = `You have played for ${hours} hours and ${minutes} minutes total.

💎 **Premium Value**: Premium subscribers get unlimited play time and advanced time analytics to optimize their gaming sessions!`;
    } else if (query.includes('streak') || query.includes('current streak')) {
      response = `Your current streak is ${usageMetrics.currentStreakDays} days.

💎 **Premium Streaks**: Premium subscribers get streak protection and bonus rewards for maintaining streaks!`;
    } else if (query.includes('longest streak')) {
      response = `Your longest streak was ${usageMetrics.longestStreakDays} days.

💎 **Premium Streaks**: Premium subscribers get streak protection and bonus rewards for maintaining streaks!`;
    } else if (query.includes('days') || query.includes('active')) {
      response = `You have been active for ${usageMetrics.daysLoggedIn} days.

💎 **Premium Activity**: Premium subscribers get daily login bonuses and exclusive rewards for consistent activity!`;
    } else {
      response = `I can help you with:

📊 **Your Stats**: words found, level, score, games played, coins, points, gems, battles, play time, streaks, and activity
🎮 **Gameplay Help**: how to play, scoring, daily themes, missions, battles, tips, and strategy
📈 **Analytics**: performance insights, time patterns, and improvement suggestions
🎨 **Customization**: frames, backgrounds, fonts, colors, and personalization
💎 **Premium Features**: subscription benefits, pricing, and exclusive content
💰 **Payment & Purchases**: payment methods, in-app purchases, and billing
🏆 **Leaderboards**: rankings, competition, and social features
🆘 **Help & Support**: troubleshooting, contact info, and common issues
💡 **Try asking**: 
• "How do I play?"
• "What are premium features?"
• "How do I change frames?"
• "How do I customize backgrounds?"
• "How do I change font colors?"
• "What's my ranking?"
• "Give me some tips!"

💎 **Pro Tip**: Premium subscribers get exclusive content, unlimited games, and priority support!`;
    }
    
    setAiResponse(response);
    
    // Call callback if provided (for voice response)
    if (callback) {
      setTimeout(() => callback(response), 100); // Small delay to ensure state is updated
    }
  };

  // Voice interaction functions
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    interface SpeechRecognitionConstructor {
      new (): SpeechRecognition;
    }

    interface SpeechRecognition {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start(): void;
    }

    const SpeechRecognition = (window as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition || (window as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not available.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      console.log('Voice recognition result:', transcript);
      setAiQuery(transcript);
      setIsListening(false);
      
      // Auto-trigger the AI query after speech recognition
      setTimeout(() => {
        console.log('Processing AI query with transcript:', transcript);
        handleAiQuery((response) => {
          console.log('AI response received:', response);
          // This callback will be called with the AI response
          speakResponse(response);
        }, transcript); // Pass the transcript directly
      }, 100); // Reduced delay since we're passing the transcript directly
    };
    
    recognition.onerror = (event: { error: string }) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // If we're muting and currently speaking, stop speech immediately
    if (newMutedState) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    
    // If we're unmuting and there's a response to speak, speak it
    if (!newMutedState && aiResponse && aiResponse.trim() !== '') {
      setTimeout(() => {
        speakResponse(aiResponse);
      }, 100);
    }
  };

  const openAiModal = () => {
    handleLexiInteraction(); // Track interaction and hide popup
    setAiModalOpen(true);
    const welcomeMessage = `Hi! I'm Lexi, your AI WordFlect assistant. I can help you with gameplay, stats, customization, and even navigation. You can ask me to take you to the dashboard, sign you out, or open the WordFlect app. Try saying "How do I play?", "Take me to dashboard", or "Open app". Click the voice icon to enable audio, or use the text input to chat with me!`;
    const WELCOME_KEY = 'lexiWelcomeSpoken';
    const hasWindow = typeof window !== 'undefined';
    const alreadyWelcomed = hasWindow ? localStorage.getItem(WELCOME_KEY) === '1' : false;

    if (!alreadyWelcomed) {
      // Show and auto-speak only on the first time the user opens Lexi
      setAiResponse(welcomeMessage);
      setTimeout(() => {
        speakResponse(welcomeMessage, true);
        try { if (hasWindow) localStorage.setItem(WELCOME_KEY, '1'); } catch {}
      }, 500);
    } else {
      // Do not auto-speak on subsequent opens; keep existing response or a short prompt
      setAiResponse((prev) => prev || "Hi! I'm Lexi. How can I help?");
    }
  };

  // ElevenLabs TTS function
  const speakWithElevenLabs = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      // Call our API route that handles ElevenLabs
      const response = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('ElevenLabs TTS failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        // Re-focus input to allow immediate follow-up
        try { aiInputRef.current?.focus(); } catch {}
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        try { aiInputRef.current?.focus(); } catch {}
      };
      
      await audio.play();
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      setIsSpeaking(false);
      // Fallback to browser TTS
      fallbackToBrowserTTS(text);
    }
  };

  // Fallback to browser TTS
  const fallbackToBrowserTTS = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 0.95;
    utterance.volume = 0.8;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); try { aiInputRef.current?.focus(); } catch {} };
    utterance.onerror = () => { setIsSpeaking(false); try { aiInputRef.current?.focus(); } catch {} };
    
    window.speechSynthesis.speak(utterance);
  };

  const speakResponse = (responseText?: string, forceUnmute = false) => {
    if (isMuted && !forceUnmute) {
      return; // Don't speak if muted (unless forced)
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = responseText || aiResponse;
    if (!textToSpeak || textToSpeak.trim() === '') {
      alert('No response to speak.');
      return;
    }

    // Clean up the text for better speech
    const cleanResponse = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
      .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
      .replace(/[🎯🎮📊💎🎨💰🏆🆘💡⏰📈📝🧠⚔️📅🖼️🌈🎉🚀⭐✨🎊🎁🎈🎂🍰🎪🎭🎨🎬🎵🎶🎸🎹🎺🎻🎼🎤🎧]/g, '') // Remove emojis
      .replace(/\n\n+/g, '. ') // Multiple newlines to pause
      .replace(/\n/g, '. ') // Single newlines to pause
      .replace(/\s+/g, ' ') // Clean up multiple spaces
      .trim();

    // Try ElevenLabs first, fallback to browser TTS
    speakWithElevenLabs(cleanResponse);
  };

  // Check for speech support on component mount
  useEffect(() => {
    const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    setSpeechSupported(hasSpeechRecognition && hasSpeechSynthesis);
    
    // Load voices if speech synthesis is supported
    if (hasSpeechSynthesis) {
      // Voices might not be immediately available, so we load them
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          console.log('Available voices:', voices.map(v => v.name));
        }
      };
      
      // Load voices immediately and on voice change
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Helper function to determine current time period (using local time)
  const getCurrentTimePeriod = () => {
    const now = new Date();
    const hour = now.getHours(); // Use local time instead of UTC
    
    if (hour >= 0 && hour <= 3) return 'late-night';      // 00:00 - 03:59
    if (hour >= 4 && hour <= 8) return 'early-morning';   // 04:00 - 08:59
    if (hour >= 9 && hour <= 12) return 'late-morning';   // 09:00 - 12:59
    if (hour >= 13 && hour <= 17) return 'afternoon';     // 13:00 - 17:59
    if (hour >= 18 && hour <= 23) return 'evening';       // 18:00 - 23:59
    return 'late-night'; // fallback
  };

  // Helper to render local AM/PM labels with :59 ends (no gaps)
  const getLocalAmPmLabel = (period: string) => {
    switch (period) {
      case 'late-night':
        return '12:00 AM–3:59 AM';
      case 'early-morning':
        return '4:00 AM–8:59 AM';
      case 'late-morning':
        return '9:00 AM–12:59 PM';
      case 'afternoon':
        return '1:00 PM–5:59 PM';
      case 'evening':
        return '6:00 PM–11:59 PM';
      default:
        return '12:00 AM–11:59 PM';
    }
  };

  // Convert backend label from 24-hour format to 12-hour AM/PM format
  // Example: "09:00-12:59 EST/EDT" -> "9:00 AM–12:59 PM EST/EDT"
  const convertLabelToAmPm = (label: string | undefined): string => {
    if (!label) return '';
    
    // Match pattern like "09:00-12:59 EST/EDT" or "00:00-03:59 PST/PDT"
    const match = label.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})\s*(.+)$/);
    if (!match) return label; // Return as-is if format doesn't match
    
    const [, startHour, startMin, endHour, endMin, timezone] = match;
    
    const convertHour = (hourStr: string): { hour: number; ampm: string } => {
      const hour = parseInt(hourStr, 10);
      if (hour === 0) return { hour: 12, ampm: 'AM' };
      if (hour === 12) return { hour: 12, ampm: 'PM' };
      if (hour < 12) return { hour, ampm: 'AM' };
      return { hour: hour - 12, ampm: 'PM' };
    };
    
    const start = convertHour(startHour);
    const end = convertHour(endHour);
    
    return `${start.hour}:${startMin} ${start.ampm}–${end.hour}:${endMin} ${end.ampm} ${timezone}`;
  };

  // Helper function to get time period data
  const getTimePeriodData = (period: string) => {
    console.log(`🔍 getTimePeriodData called for ${period}`);
    console.log(`🔍 timeAnalytics exists:`, !!timeAnalytics);
    console.log(`🔍 timeAnalytics.timePeriods exists:`, !!(timeAnalytics as Record<string, unknown>)?.timePeriods);
    
    if (!timeAnalytics || !(timeAnalytics as Record<string, unknown>).timePeriods) {
      console.log('❌ No time analytics or timePeriods data available');
      console.log('❌ timeAnalytics:', timeAnalytics);
      return null;
    }

    // Backend returns timePeriods as an object with period keys, not an array
    const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, unknown>;
    console.log(`🔍 Available period keys:`, Object.keys(timePeriods || {}));
    const periodData = timePeriods[period];
    
    console.log(`🔍 Getting time period data for ${period}:`, periodData);
    console.log(`🔍 Period data type:`, typeof periodData);
    console.log(`🔍 Period data is truthy:`, !!periodData);
    
    if (periodData) {
      const data = periodData as Record<string, unknown>;
      
      const wordsFoundBackend = (data.wordCount as number) || 0;
      const gamesPlayedBackend = (data.gamesPlayed as number) || 0;
      // Client-side fallback: sum wordsFound and count sessions to reflect latest games immediately
      const sessions = Array.isArray((data as Record<string, unknown>).sessions) ? (data as Record<string, unknown>).sessions as Array<{ wordsFound?: number }> : [];
      const sessionSum = sessions.reduce((sum, s) => sum + (typeof s?.wordsFound === 'number' ? s.wordsFound! : 0), 0);
      const sessionCount = sessions.length;
      const wordsFound = Math.max(wordsFoundBackend, sessionSum);
      const gamesPlayed = Math.max(gamesPlayedBackend, sessionCount); // Use session count as fallback
      console.log(`🔍 ${period} fallback: backend games=${gamesPlayedBackend}, sessions.length=${sessionCount}, using games=${gamesPlayed}`);
      console.log(`🔍 ${period} fallback: backend words=${wordsFoundBackend}, sessionSum=${sessionSum}, using words=${wordsFound}`);
      const avgPerGame = gamesPlayed > 0 ? Math.round(wordsFound / gamesPlayed) : 0;
      
      // Calculate performance relative to personal best across all periods
      const allPeriods = Object.values(timeAnalytics.timePeriods as Record<string, unknown>);
      const maxWordsInAnyPeriod = Math.max(...allPeriods.map(p => {
        const pd = p as Record<string, unknown>;
        const w = (pd.wordCount as number) || 0;
        const ss = Array.isArray(pd.sessions) ? (pd.sessions as Array<{ wordsFound?: number }>).reduce((sum, s) => sum + (s.wordsFound || 0), 0) : 0;
        return Math.max(w, ss);
      }));
      const performance = maxWordsInAnyPeriod > 0 ? Math.round((wordsFound / maxWordsInAnyPeriod) * 100) : 0;
      
      console.log(`📊 ${period} stats:`, { wordsFound, gamesPlayed, avgPerGame, performance, maxWordsInAnyPeriod });
      
      let status = 'No data';
      if (performance >= 90) status = '🏆 Peak performance!';
      else if (performance >= 70) status = '📈 Strong performance';
      else if (performance >= 50) status = '📊 Good performance';
      else if (performance >= 25) status = '📉 Moderate performance';
      else if (performance > 0) status = '🌱 Building momentum';
      else status = '😴 No activity';

      return {
        wordsFound,
        gamesPlayed,
        avgPerGame,
        performance,
        status,
        label: convertLabelToAmPm((data.label as string) || '') || getLocalAmPmLabel(period) // Convert backend label to AM/PM format
      };
    }

    console.log(`❌ No data found for period ${period}`);
    return {
      wordsFound: 0,
      gamesPlayed: 0,
      avgPerGame: 0,
      performance: 0,
      status: 'No data',
      label: getLocalAmPmLabel(period) // Provide default label
    };
  };

  // Calendar data calculation functions
  const getDaysActiveData = () => {
    // Try to get sessions from detailedStats first, then fallback to timeAnalytics
    let sessions: Session[] = [];
    
    if (detailedStats?.sessionHistory && detailedStats.sessionHistory.length > 0) {
      sessions = detailedStats.sessionHistory;
      console.log('🗓️ Using detailedStats.sessionHistory:', sessions.length, 'sessions');
    } else if (timeAnalytics && (timeAnalytics as Record<string, unknown>).timePeriods) {
      const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, unknown>;
      Object.values(timePeriods).forEach(period => {
        const periodSessions = (period as Record<string, unknown>)?.sessions as Session[] || [];
        sessions.push(...periodSessions);
      });
      console.log('🗓️ Using timeAnalytics sessions:', sessions.length, 'sessions');
    }
    
    if (sessions.length === 0) {
      console.log('🗓️ No session data available for calendar');
      return [];
    }
    
    const daySet = new Set<string>();
    sessions.forEach(session => {
      const timestamp = session.startTime || session.timestamp;
      if (timestamp) {
        const date = new Date(timestamp);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        daySet.add(dayKey);
      }
    });
    
    console.log('🗓️ Found', daySet.size, 'unique active days');
    
    // Generate calendar data for the last 12 months
    const data: { date: string; active: boolean }[] = [];
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      data.push({
        date: dayKey,
        active: daySet.has(dayKey)
      });
    }
    
    return data;
  };
  
  const getCurrentStreakData = () => {
    // Try to get sessions from detailedStats first, then fallback to timeAnalytics
    let sessions: Session[] = [];
    
    if (detailedStats?.sessionHistory && detailedStats.sessionHistory.length > 0) {
      sessions = detailedStats.sessionHistory;
      console.log('🗓️ Current Streak: Using detailedStats.sessionHistory:', sessions.length, 'sessions');
    } else if (timeAnalytics && (timeAnalytics as Record<string, unknown>).timePeriods) {
      const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, unknown>;
      Object.values(timePeriods).forEach(period => {
        const periodSessions = (period as Record<string, unknown>)?.sessions as Session[] || [];
        sessions.push(...periodSessions);
      });
      console.log('🗓️ Current Streak: Using timeAnalytics sessions:', sessions.length, 'sessions');
    }
    
    if (sessions.length === 0) {
      console.log('🗓️ Current Streak: No session data available');
      return { data: [], startDate: undefined, endDate: undefined };
    }
    
    const daySet = new Set<string>();
    sessions.forEach(session => {
      const timestamp = session.startTime || session.timestamp;
      if (timestamp) {
        const date = new Date(timestamp);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        daySet.add(dayKey);
      }
    });
    
    const sortedDays = Array.from(daySet).sort();
    if (sortedDays.length === 0) return { data: [], startDate: undefined, endDate: undefined };
    
    // Find current streak
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    
    // Find the actual consecutive streak by walking backwards from today
    let streakEnd = sortedDays[sortedDays.length - 1];
    let streakStart = streakEnd;
    
    // Check if streak is still active (includes today or yesterday)
    if (!sortedDays.includes(todayKey) && !sortedDays.includes(yesterdayKey)) {
      // Streak is not active, find the last consecutive sequence
      streakEnd = sortedDays[sortedDays.length - 1];
      streakStart = streakEnd;
      
      // Walk backwards to find consecutive days
      for (let i = sortedDays.length - 2; i >= 0; i--) {
        const prevDate = new Date(sortedDays[i]);
        const currDate = new Date(streakStart);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          streakStart = sortedDays[i];
        } else {
          break;
        }
      }
    } else {
      // Streak is active, include today if needed
      if (sortedDays.includes(todayKey)) {
        streakEnd = todayKey;
      } else if (sortedDays.includes(yesterdayKey)) {
        streakEnd = todayKey; // Include today even if no session yet
      }
      
      streakStart = sortedDays[sortedDays.length - 1];
      
      // Walk backwards to find consecutive days
      for (let i = sortedDays.length - 2; i >= 0; i--) {
        const prevDate = new Date(sortedDays[i]);
        const currDate = new Date(streakStart);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          streakStart = sortedDays[i];
        } else {
          break;
        }
      }
    }
    
    // Generate calendar data for streak period
    // Mark ALL consecutive days in the streak range as active
    const data: { date: string; active: boolean }[] = [];
    const startDateObj = new Date(streakStart + 'T00:00:00');
    const endDateObj = new Date(streakEnd + 'T00:00:00');
    
    // Generate all days in the streak range
    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      // For current streak, mark ALL consecutive days as active
      data.push({
        date: dayKey,
        active: true // All days in streak range are active
      });
    }
    
    return { data, startDate: streakStart, endDate: streakEnd };
  };
  
  const getBestStreakData = () => {
    // Try to get sessions from detailedStats first, then fallback to timeAnalytics
    let sessions: Session[] = [];
    
    if (detailedStats?.sessionHistory && detailedStats.sessionHistory.length > 0) {
      sessions = detailedStats.sessionHistory;
      console.log('🗓️ Best Streak: Using detailedStats.sessionHistory:', sessions.length, 'sessions');
    } else if (timeAnalytics && (timeAnalytics as Record<string, unknown>).timePeriods) {
      const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, unknown>;
      Object.values(timePeriods).forEach(period => {
        const periodSessions = (period as Record<string, unknown>)?.sessions as Session[] || [];
        sessions.push(...periodSessions);
      });
      console.log('🗓️ Best Streak: Using timeAnalytics sessions:', sessions.length, 'sessions');
    }
    
    if (sessions.length === 0) {
      console.log('🗓️ Best Streak: No session data available');
      return { data: [], startDate: undefined, endDate: undefined };
    }
    
    const daySet = new Set<string>();
    sessions.forEach(session => {
      const timestamp = session.startTime || session.timestamp;
      if (timestamp) {
        const date = new Date(timestamp);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        daySet.add(dayKey);
      }
    });
    
    const sortedDays = Array.from(daySet).sort();
    if (sortedDays.length === 0) return { data: [], startDate: undefined, endDate: undefined };
    
    // Find longest streak
    let longestStreak = 0;
    let longestStart = sortedDays[0];
    let longestEnd = sortedDays[0];
    let currentStreak = 1;
    let currentStart = sortedDays[0];
    
    for (let i = 1; i < sortedDays.length; i++) {
      const prevDate = new Date(sortedDays[i-1]);
      const currDate = new Date(sortedDays[i]);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
      } else {
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          longestStart = currentStart;
          longestEnd = sortedDays[i-1];
        }
        currentStreak = 1;
        currentStart = sortedDays[i];
      }
    }
    
    // Check final streak
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      longestStart = currentStart;
      longestEnd = sortedDays[sortedDays.length - 1];
    }
    
    // Generate calendar data for longest streak period
    // Mark ALL consecutive days in the streak as active
    const data: { date: string; active: boolean }[] = [];
    const startDate = new Date(longestStart);
    const endDate = new Date(longestEnd);
    
    // Get all days in the longest streak range
    const sortedDaysInStreak = sortedDays.filter(day => day >= longestStart && day <= longestEnd);
    
    // Generate all days in range, marking as active if they're in the consecutive streak
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      // For streak, mark ALL days in the range as active (they should be consecutive)
      data.push({
        date: dayKey,
        active: sortedDaysInStreak.includes(dayKey)
      });
    }
    
    return { data, startDate: longestStart, endDate: longestEnd };
  };
  
  const openCalendarModal = (type: 'days-active' | 'current-streak' | 'best-streak') => {
    console.log('🗓️ Opening calendar modal for type:', type);
    console.log('🗓️ detailedStats?.sessionHistory:', detailedStats?.sessionHistory?.length, 'sessions');
    console.log('🗓️ timeAnalytics:', timeAnalytics);
    
    // Check if we have session data from timeAnalytics
    if (timeAnalytics && (timeAnalytics as Record<string, unknown>).timePeriods) {
      const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, unknown>;
      const allSessions: Session[] = [];
      Object.values(timePeriods).forEach(period => {
        const sessions = (period as Record<string, unknown>)?.sessions as Session[] || [];
        allSessions.push(...sessions);
      });
      console.log('🗓️ Sessions from timeAnalytics:', allSessions.length, 'sessions');
      console.log('🗓️ Sample session from timeAnalytics:', allSessions[0]);
    }
    
    let title = '';
    let data: { date: string; active: boolean }[] = [];
    let startDate: string | undefined;
    let endDate: string | undefined;
    
    switch (type) {
      case 'days-active':
        title = 'Days Active Calendar';
        data = getDaysActiveData();
        console.log('🗓️ Days Active data:', data.length, 'days, active:', data.filter(d => d.active).length);
        break;
      case 'current-streak':
        title = 'Current Streak Calendar';
        const currentData = getCurrentStreakData();
        data = currentData.data;
        startDate = currentData.startDate;
        endDate = currentData.endDate;
        console.log('🗓️ Current Streak data:', data.length, 'days, active:', data.filter(d => d.active).length);
        console.log('🗓️ Current Streak dates:', startDate, 'to', endDate);
        break;
      case 'best-streak':
        title = 'Best Streak Calendar';
        const bestData = getBestStreakData();
        data = bestData.data;
        startDate = bestData.startDate;
        endDate = bestData.endDate;
        console.log('🗓️ Best Streak data:', data.length, 'days, active:', data.filter(d => d.active).length);
        console.log('🗓️ Best Streak dates:', startDate, 'to', endDate);
        break;
    }
    
    console.log('🗓️ Final calendar data sample:', data.slice(0, 5));
    
    setCalendarModal({
      isOpen: true,
      type,
      title,
      data,
      startDate,
      endDate
    });
  };

  // Helper function to get theme data
  const getThemeData = (day: string) => {
    console.log('getThemeData called for day:', day);
    console.log('themeAnalytics:', themeAnalytics);
    
    if (!themeAnalytics) {
      console.log('No theme analytics data available');
      return null;
    }

    // Map day names to theme names
    const dayToThemeMap = {
      monday: 'Food & Drinks',
      tuesday: 'Common Nouns',
      wednesday: 'Nature',
      thursday: 'Adjectives',
      friday: 'Animals',
      saturday: 'Colors',
      sunday: 'Actions'
    };

    const themeName = dayToThemeMap[day as keyof typeof dayToThemeMap];
    if (!themeName) {
      console.log('Unknown day:', day);
      return null;
    }

    // Prefer detailed backend response if already fetched for this day
    const details = (themeAnalytics as Record<string, unknown>)[`${day}_themeDetails`] as ThemeDayResponse | undefined;
    console.log(`getThemeData - ${day} details:`, details);
    console.log(`getThemeData - ${day} details.theme:`, details?.theme);
    console.log(`getThemeData - ${day} details.theme.words:`, details?.theme?.words);
    
    if (details && details.theme && Array.isArray(details.theme.words)) {
      console.log(`getThemeData - ${day} using details.theme.words`);
      const totalWords = details.theme.words.length;
      // Derive found count from allThemeWords (with found flags) or stats/progress fallbacks
      let found = 0;
      if (Array.isArray(details.allThemeWords)) {
        found = details.allThemeWords.filter(w => !!w.found).length;
      } else if (typeof details.stats?.totalThemeWordsFound === 'number') {
        found = details.stats.totalThemeWordsFound;
      } else if (Array.isArray(details.progress?.foundWords)) {
        found = details.progress!.foundWords!.length;
      }
      return {
        wordsFound: found,
        totalWords,
        completionPercent: totalWords > 0 ? Math.round((found / totalWords) * 100) : 0,
        words: details.theme.words,
        foundWords: [] as string[]
      };
    }
    // Fallback: use pre-fetched themeWords list + stored progress to populate card without opening modal
    // ONLY use this if we have data for THIS specific day
    const words = (themeAnalytics as Record<string, unknown>)[`${day}_themeWords`] as string[] | undefined;
    const prog = getProgressFor(day);
    console.log(`getThemeData - ${day} fallback words:`, words);
    console.log(`getThemeData - ${day} fallback progress:`, prog);
    
    if (Array.isArray(words) && words.length) {
      console.log(`getThemeData - ${day} using fallback words array`);
      const totalWords = words.length;
      const found = prog?.found ?? 0;
      return {
        wordsFound: found,
        totalWords,
        completionPercent: totalWords > 0 ? Math.round((found / totalWords) * 100) : 0,
        words,
        foundWords: [] as string[]
      };
    }

    // If we don't have data for this specific day, return null so card shows "tap to load"
    console.log(`getThemeData - ${day} has no data, returning null`);
    return null;
  };

  const getThemeName = (day: string) => {
    // Try to get theme name from the stored backend response
    if (themeAnalytics && (themeAnalytics as Record<string, unknown>)[`${day}_response`]) {
      const backendResponse = (themeAnalytics as Record<string, unknown>)[`${day}_response`] as Record<string, unknown>;
      if (backendResponse && backendResponse.theme && (backendResponse.theme as Record<string, unknown>).name) {
        return (backendResponse.theme as Record<string, unknown>).name as string;
      }
    }
    
    // Fallback to hardcoded names if backend data not available
    const fallbackNames = {
      monday: 'Food & Drinks',
      tuesday: 'Common Nouns',
      wednesday: 'Nature',
      thursday: 'Adjectives',
      friday: 'Animals',
      saturday: 'Colors',
      sunday: 'Actions'
    };
    return fallbackNames[day as keyof typeof fallbackNames] || day;
  };

  type ThemeDayProgress = { found: number; total: number };
  const getProgressFor = (day: string): ThemeDayProgress | undefined => {
    const ta = themeAnalytics as Record<string, unknown> | null;
    if (!ta) {
      console.log(`🎯 getProgressFor(${day}): themeAnalytics is null`);
      return undefined;
    }
    
    // First, check if we have theme details from backend API (most accurate)
    const detailsKey = `${day}_themeDetails`;
    const details = ta[detailsKey] as ThemeDayResponse | undefined;
    if (details && details.theme && Array.isArray(details.theme.words)) {
      console.log(`🎯 getProgressFor(${day}): Using themeDetails from backend`);
      const totalWords = details.theme.words.length;
      
      // Extract found count from allThemeWords (with found flags) or stats/progress
      let found = 0;
      if (Array.isArray(details.allThemeWords)) {
        found = details.allThemeWords.filter(w => {
          if (typeof w === 'string') return false;
          return !!w.found;
        }).length;
      } else if (typeof details.stats?.totalThemeWordsFound === 'number') {
        found = details.stats.totalThemeWordsFound;
      } else if (Array.isArray(details.progress?.foundWords)) {
        found = details.progress!.foundWords!.length;
      }
      
      // Store theme words for card display
      if (!ta[`${day}_themeWords`]) {
        ta[`${day}_themeWords`] = details.theme.words;
      }
      
      return { found, total: totalWords };
    }
    
    // Fallback: check for stored progress
    const key = `${day}_progress`;
    const value = ta[key];
    console.log(`🎯 getProgressFor(${day}): key=${key}, value=`, value);
    if (
      value &&
      typeof value === 'object' &&
      'found' in (value as Record<string, unknown>) &&
      'total' in (value as Record<string, unknown>)
    ) {
      const v = value as { found?: unknown; total?: unknown };
      const found = typeof v.found === 'number' ? v.found : 0;
      const total = typeof v.total === 'number' ? v.total : 20;
      return { found, total };
    }
    return undefined;
  };
  const getThemePerformanceSummary = () => {
    if (!profile || !profile.allFoundWords || profile.allFoundWords.length === 0) {
      return {
        bestTheme: { name: 'No data', day: '', percentage: 0 },
        mostConsistent: { name: 'No data', day: '', percentage: 0 },
        totalThemeWords: 0
      };
    }

    // Define theme words for each day of the week
    // Use the same rotation logic as mobile app for consistent theme words
    const getThemeWordsForDay = (dayOfWeek: string, setIndex: number) => {
      const THEME_WORD_SETS = {
        monday: {
          name: 'Food & Drinks',
          sets: [
            ['PIZZA', 'BURGER', 'SALAD', 'COFFEE', 'JUICE', 'BREAD', 'CHEESE', 'APPLE', 'BANANA', 'GRAPE', 'ORANGE', 'LEMON', 'PASTA', 'RICE', 'SOUP', 'CAKE', 'COOKIE', 'CANDY', 'CHOCOLATE', 'SANDWICH'],
            ['TACO', 'SUSHI', 'STEAK', 'CHICKEN', 'PORK', 'LAMB', 'SHRIMP', 'TUNA', 'MANGO', 'KIWI', 'AVOCADO', 'ORANGE', 'TOMATO', 'CARROT', 'ONION', 'POTATO', 'CORN', 'BEANS', 'VANILLA', 'MINT'],
            ['CARAMEL', 'MAPLE', 'HONEY', 'GARLIC', 'JAM', 'JELLY', 'SYRUP', 'GRAPE', 'LEMON', 'LIME', 'CHERRY', 'BERRY', 'PEACH', 'PLUM', 'PEAR', 'DATE', 'MILK', 'WATER', 'TEA', 'HOTDOG'],
            ['PIZZA', 'BURGER', 'SALAD', 'COFFEE', 'JUICE', 'BREAD', 'CHEESE', 'APPLE', 'BANANA', 'GRAPE', 'ORANGE', 'LEMON', 'PASTA', 'RICE', 'SOUP', 'CAKE', 'COOKIE', 'CANDY', 'CHOCOLATE', 'SANDWICH']
          ]
        },
        tuesday: {
          name: 'Common Nouns',
          sets: [
            ['HOUSE', 'CAR', 'TREE', 'BOOK', 'PHONE', 'CHAIR', 'TABLE', 'DOOR', 'WINDOW', 'CLOCK', 'MONEY', 'MUSIC', 'FAMILY', 'FRIEND', 'SCHOOL', 'WORK', 'GAME', 'MOVIE', 'STORY', 'DREAM'],
            ['LAMP', 'SOFA', 'DESK', 'SHELF', 'MIRROR', 'SONG', 'HOUR', 'MORNING', 'EVENING', 'PARTY', 'GIFT', 'PERSON', 'MAN', 'WOMAN', 'CHILD', 'BABY', 'SOLDIER', 'POLICE', 'FARMER', 'WORKER'],
            ['STUDENT', 'PLAYER', 'RUNNER', 'SWIMMER', 'DANCER', 'SINGER', 'TEACHER', 'DOCTOR', 'LAWYER', 'ENGINEER', 'ARTIST', 'WRITER', 'COOK', 'DRIVER', 'PARK', 'STORE', 'WATCH', 'CLOCK', 'LAMP', 'SOFA'],
            ['HOUSE', 'CAR', 'TREE', 'BOOK', 'PHONE', 'CHAIR', 'TABLE', 'DOOR', 'WINDOW', 'CLOCK', 'MONEY', 'MUSIC', 'FAMILY', 'FRIEND', 'SCHOOL', 'WORK', 'GAME', 'MOVIE', 'STORY', 'DREAM']
          ]
        },
        wednesday: {
          name: 'Nature',
          sets: [
            ['TREE', 'FLOWER', 'GRASS', 'LEAF', 'BRANCH', 'ROOT', 'SEED', 'BUD', 'PETAL', 'STEM', 'THORN', 'BARK', 'MOSS', 'FERN', 'VINE', 'BUSH', 'SHRUB', 'HERB', 'WEED', 'MUSHROOM'],
            ['SUN', 'MOON', 'STAR', 'SKY', 'CLOUD', 'RAIN', 'SNOW', 'WIND', 'STORM', 'LIGHTNING', 'THUNDER', 'FOG', 'MIST', 'DEW', 'FROST', 'ICE', 'FIRE', 'EARTH', 'WATER', 'AIR'],
            ['MOUNTAIN', 'HILL', 'VALLEY', 'RIVER', 'OCEAN', 'LAKE', 'POND', 'STREAM', 'WATERFALL', 'BEACH', 'DESERT', 'FOREST', 'JUNGLE', 'MEADOW', 'FIELD', 'PARK', 'GARDEN', 'FARM', 'ISLAND', 'CAVE'],
            ['TREE', 'FLOWER', 'GRASS', 'LEAF', 'BRANCH', 'ROOT', 'SEED', 'BUD', 'PETAL', 'STEM', 'THORN', 'BARK', 'MOSS', 'FERN', 'VINE', 'BUSH', 'SHRUB', 'HERB', 'WEED', 'MUSHROOM']
          ]
        },
        thursday: {
          name: 'Adjectives',
          sets: [
            ['BIG', 'SMALL', 'FAST', 'SLOW', 'HOT', 'COLD', 'NEW', 'OLD', 'GOOD', 'BAD', 'HAPPY', 'SAD', 'BEAUTIFUL', 'STRONG', 'SMART', 'FUNNY', 'QUIET', 'LOUD', 'BRIGHT', 'DARK'],
            ['TALL', 'SHORT', 'FAT', 'THIN', 'YOUNG', 'OLD', 'NICE', 'EASY', 'HARD', 'SIMPLE', 'CLEAN', 'DIRTY', 'FRESH', 'STALE', 'SWEET', 'SOUR', 'BITTER', 'HANDSOME', 'CUTE', 'SERIOUS'],
            ['FRIENDLY', 'SHY', 'WISE', 'HONEST', 'FAIR', 'BRAVE', 'SOFT', 'HARD', 'WARM', 'COOL', 'DRY', 'WET', 'HEAVY', 'LIGHT', 'THICK', 'THIN', 'WIDE', 'NARROW', 'DEEP', 'SHALLOW'],
            ['TALL', 'SHORT', 'FAT', 'THIN', 'YOUNG', 'OLD', 'NICE', 'EASY', 'HARD', 'SIMPLE', 'CLEAN', 'DIRTY', 'FRESH', 'STALE', 'SWEET', 'SOUR', 'BITTER', 'HANDSOME', 'CUTE', 'SERIOUS']
          ]
        },
        friday: {
          name: 'Animals',
          sets: [
            ['DOG', 'CAT', 'BIRD', 'FISH', 'BEAR', 'LION', 'TIGER', 'ELEPHANT', 'MONKEY', 'RABBIT', 'MOUSE', 'SNAKE', 'HORSE', 'COW', 'PIG', 'SHEEP', 'GOAT', 'CHICKEN', 'DUCK', 'OWL'],
            ['EAGLE', 'WOLF', 'FOX', 'DEER', 'SEAL', 'WHALE', 'SHARK', 'CRAB', 'SNAIL', 'SPIDER', 'HAMSTER', 'TURTLE', 'LIZARD', 'GECKO', 'IGUANA', 'NEWT', 'TOAD', 'LADYBUG', 'DRAGONFLY', 'BUTTERFLY'],
            ['PANDA', 'KOALA', 'MUSSEL', 'SCALLOP', 'TUNA', 'SALMON', 'TROUT', 'BASS', 'PIKE', 'PERCH', 'CARP', 'GOLDFISH', 'DOLPHIN', 'OTTER', 'BEAVER', 'RACCOON', 'SKUNK', 'POSSUM', 'BAT', 'SQUIRREL'],
            ['DOG', 'CAT', 'BIRD', 'FISH', 'BEAR', 'LION', 'TIGER', 'ELEPHANT', 'MONKEY', 'RABBIT', 'MOUSE', 'SNAKE', 'HORSE', 'COW', 'PIG', 'SHEEP', 'GOAT', 'CHICKEN', 'DUCK', 'OWL']
          ]
        },
        saturday: {
          name: 'Colors',
          sets: [
            ['RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BLACK', 'WHITE', 'BROWN', 'GRAY', 'SILVER', 'GOLD', 'BRONZE', 'COPPER', 'ROSE', 'LIME', 'CYAN', 'MAGENTA', 'VIOLET'],                                                     
            ['CRIMSON', 'SCARLET', 'BURGUNDY', 'MAROON', 'RUST', 'CORAL', 'SALMON', 'PEACH', 'APRICOT', 'TANGERINE', 'AMBER', 'CHARTREUSE', 'OLIVE', 'FOREST', 'EMERALD', 'TURQUOISE', 'TEAL', 'NAVY', 'ROYAL', 'INDIGO'],                                                      
            ['LAVENDER', 'LILAC', 'MAUVE', 'BEIGE', 'TAN', 'KHAKI', 'CREAM', 'IVORY', 'PEARL', 'PLATINUM', 'CHARCOAL', 'SLATE', 'STEEL', 'GUNMETAL', 'BRONZE', 'BRASS', 'COPPER', 'RUST', 'PATINA', 'VERDIGRIS'],             
            ['AQUA', 'AZURE', 'CERULEAN', 'COBALT', 'ULTRAMARINE', 'PRUSSIAN', 'SAPPHIRE', 'PERIWINKLE', 'CORNFLOWER', 'SKY', 'POWDER', 'BABY', 'ROBIN', 'EGG', 'MINT', 'SEAFOAM', 'JADE', 'MOSS', 'SAGE', 'HUNTER']                                        
          ]
        },
        sunday: {
          name: 'Actions',
          sets: [
            ['RUN', 'WALK', 'JUMP', 'SWIM', 'DANCE', 'SING', 'READ', 'WRITE', 'DRAW', 'PAINT', 'COOK', 'CLEAN', 'LEARN', 'TEACH', 'HELP', 'LOVE', 'THINK', 'DREAM', 'CREATE', 'BUILD'],
            ['EAT', 'SIT', 'GET', 'PUT', 'SET', 'TALK', 'SLEEP', 'WATCH', 'PLAY', 'WORK', 'STOP', 'MOVE', 'HOLD', 'DROP', 'LIFT', 'PUSH', 'PULL', 'ENTER', 'EXIT', 'CATCH'],
            ['THROW', 'HIT', 'MISS', 'CALL', 'SEND', 'MAKE', 'DO', 'HAVE', 'USE', 'WANT', 'NEED', 'SAVE', 'FIND', 'LOSE', 'WIN', 'START', 'FINISH', 'DESTROY', 'EXPLORE', 'DISCOVER'],
            ['RUN', 'WALK', 'JUMP', 'SWIM', 'DANCE', 'SING', 'READ', 'WRITE', 'DRAW', 'PAINT', 'COOK', 'CLEAN', 'LEARN', 'TEACH', 'HELP', 'LOVE', 'THINK', 'DREAM', 'CREATE', 'BUILD']
          ]
        }
      };
      
      const themeData = THEME_WORD_SETS[dayOfWeek as keyof typeof THEME_WORD_SETS] || THEME_WORD_SETS.monday;
      return themeData.sets[setIndex] || themeData.sets[0];
    };
    
    // Get the setIndex from the earlier calculation
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const setIndex = weekNumber % 4; // 4 sets per theme
    
    const themeWords = {
      monday: getThemeWordsForDay('monday', setIndex),
      tuesday: getThemeWordsForDay('tuesday', setIndex),
      wednesday: getThemeWordsForDay('wednesday', setIndex),
      thursday: getThemeWordsForDay('thursday', setIndex),
      friday: getThemeWordsForDay('friday', setIndex),
      saturday: getThemeWordsForDay('saturday', setIndex),
      sunday: getThemeWordsForDay('sunday', setIndex)
    };

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const themeStats: Record<string, { wordsFound: number; totalWords: number; completionPercent: number }> = {};

    // Initialize stats for each day
    dayNames.forEach(day => {
      themeStats[day] = { wordsFound: 0, totalWords: themeWords[day as keyof typeof themeWords].length, completionPercent: 0 };
    });

    // Count theme words found by day of the week
    profile.allFoundWords.forEach(wordObj => {
      const word = typeof wordObj === 'string' ? wordObj : wordObj.word;
      if (!word) return;

      const wordUpper = word.toUpperCase();
      const foundDate = typeof wordObj === 'string' ? new Date() : new Date(wordObj.date || new Date());
      const dayOfWeek = foundDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayName = dayNames[dayOfWeek];

      // Check if this word is a theme word for this day
      if (themeWords[dayName as keyof typeof themeWords].includes(wordUpper)) {
        themeStats[dayName].wordsFound++;
      }
    });

    // Calculate completion percentages
    Object.keys(themeStats).forEach(day => {
      const stats = themeStats[day];
      stats.completionPercent = stats.totalWords > 0 ? Math.round((stats.wordsFound / stats.totalWords) * 100) : 0;
    });

    // Find best theme (highest completion percentage)
    let bestTheme = { name: 'No data', day: '', percentage: 0 };
    let mostConsistent = { name: 'No data', day: '', percentage: 0 };
    let totalThemeWords = 0;

    Object.entries(themeStats).forEach(([day, stats]) => {
      totalThemeWords += stats.wordsFound;

      // Find best theme (highest completion percentage)
      if (stats.completionPercent > bestTheme.percentage) {
        bestTheme = {
          name: getThemeName(day),
          day: day.charAt(0).toUpperCase() + day.slice(1),
          percentage: stats.completionPercent
        };
      }

      // Find most consistent theme (highest number of words found)
      if (stats.wordsFound > mostConsistent.percentage) {
        mostConsistent = {
          name: getThemeName(day),
          day: day.charAt(0).toUpperCase() + day.slice(1),
          percentage: stats.wordsFound
        };
      }
    });

    return { bestTheme, mostConsistent, totalThemeWords };
  };
  // Handle time period click - show time analytics data
  const handleTimePeriodClick = (period: string) => {
    console.log(`🕐 Opening time analytics for period: ${period}`);
    setSelectedThemeDay(period);
    setIsThemeModalOpen(true);
    
    // For time periods, we don't need to fetch additional data
    // The time analytics data should already be loaded
    console.log(`🕐 Time period modal opened for: ${period}`);
  };


  // Handle theme day click
  const handleThemeDayClick = async (day: string) => {
    console.log(`🎯 Fetching theme details for day: ${day}`);
    setSelectedThemeDay(day);
    setIsThemeModalOpen(true);
    console.log(`🎯 Modal opened for day: ${day}`);
    
    try {
      // Calculate the date for the selected day (this week only)
      // Use UTC date to match mobile app theme schedule
      const now = new Date();
      const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const dayOfWeek = utcDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayIndex = dayNames.indexOf(day);
      
      // Find Monday of the current week (week starts on Monday)
      const mondayOfWeek = new Date(utcDate);
      // If today is Sunday (0), go back 6 days to get Monday. Otherwise, go back (dayOfWeek - 1) days
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      mondayOfWeek.setUTCDate(utcDate.getUTCDate() - daysFromMonday);
      mondayOfWeek.setUTCHours(0, 0, 0, 0);
      
      // Calculate the selected day from Monday of the current week
      // selectedDayIndex: 0=Sunday, 1=Monday, 2=Tuesday, etc.
      // For Monday-Sunday week, we need: Monday=0, Tuesday=1, ..., Sunday=6
      const daysFromMondayToSelected = selectedDayIndex === 0 ? 6 : selectedDayIndex - 1;
      const selectedDate = new Date(mondayOfWeek);
      selectedDate.setUTCDate(mondayOfWeek.getUTCDate() + daysFromMondayToSelected);
      const selectedDateString = selectedDate.toISOString().split('T')[0];
      
      // ALWAYS verify and correct the date to ensure it matches the selected day
      const calculatedDayIndex = selectedDate.getUTCDay();
      const calculatedDayName = dayNames[calculatedDayIndex];
      let finalDateString = selectedDateString;
      
      // If the calculated date doesn't match the selected day, find the correct date
      if (calculatedDayName !== day) {
        console.error(`❌ DATE MISMATCH: Selected ${day} but calculated date ${selectedDateString} is ${calculatedDayName}!`);
        console.error(`❌ Original calculation: selectedDayIndex=${selectedDayIndex}, daysFromMondayToSelected=${daysFromMondayToSelected}`);
        // Find the correct date in the current week that matches the selected day
        let foundCorrectDate = false;
        for (let i = 0; i < 7; i++) {
          const testDate = new Date(mondayOfWeek);
          testDate.setUTCDate(mondayOfWeek.getUTCDate() + i);
          testDate.setUTCHours(0, 0, 0, 0);
          const testDayIndex = testDate.getUTCDay();
          const testDayName = dayNames[testDayIndex];
          if (testDayName === day) {
            finalDateString = testDate.toISOString().split('T')[0];
            console.error(`✅ Using corrected date: ${finalDateString} for ${day} (verified as ${testDayName})`);
            foundCorrectDate = true;
            break;
          }
        }
        if (!foundCorrectDate) {
          console.error(`❌ CRITICAL: Could not find correct date for ${day} in current week!`);
        }
      } else {
        // Double-check by verifying the final date one more time
        const verifyDate = new Date(finalDateString + 'T00:00:00.000Z');
        const verifyDayIndex = verifyDate.getUTCDay();
        const verifyDayName = dayNames[verifyDayIndex];
        if (verifyDayName !== day) {
          console.error(`❌ VERIFICATION FAILED: Final date ${finalDateString} is ${verifyDayName}, not ${day}!`);
          // Force recalculation
          for (let i = 0; i < 7; i++) {
            const testDate = new Date(mondayOfWeek);
            testDate.setUTCDate(mondayOfWeek.getUTCDate() + i);
            testDate.setUTCHours(0, 0, 0, 0);
            const testDayIndex = testDate.getUTCDay();
            const testDayName = dayNames[testDayIndex];
            if (testDayName === day) {
              finalDateString = testDate.toISOString().split('T')[0];
              console.error(`✅ Force-corrected to: ${finalDateString} for ${day}`);
              break;
            }
          }
        }
      }
      
      console.log(`🎯 DEBUG: Today is ${utcDate.toISOString().split('T')[0]} (UTC day ${dayOfWeek})`);
      console.log(`🎯 DEBUG: Selected day is ${day} (index ${selectedDayIndex})`);
      console.log(`🎯 DEBUG: Monday of current week: ${mondayOfWeek.toISOString().split('T')[0]}`);
      console.log(`🎯 DEBUG: Days from Monday to selected day: ${daysFromMondayToSelected}`);
      console.log(`🎯 DEBUG: Calculated selected date: ${selectedDateString} (verifies as ${calculatedDayName})`);
      console.log(`🎯 DEBUG: Final date to use: ${finalDateString}`);
      
      // Final verification before making the API call
      const finalVerifyDate = new Date(finalDateString + 'T00:00:00.000Z');
      const finalVerifyDay = dayNames[finalVerifyDate.getUTCDay()];
      if (finalVerifyDay !== day) {
        console.error(`❌ CRITICAL ERROR: Final date ${finalDateString} does not match ${day}! It is ${finalVerifyDay}!`);
      } else {
        console.log(`✅ VERIFIED: Final date ${finalDateString} correctly matches ${day}`);
      }
      
      // Fetch complete theme details for this specific day and date (direct backend call)
      console.log(`🎯 Fetching theme for ${day} with date: ${finalDateString}`);
      let data: Record<string, unknown>;
      try {
        data = await apiService.getThemeDayStatistics(finalDateString) as Record<string, unknown>;
        console.log(`✅ Theme day details from backend for ${day}:`, data);
      } catch (apiError) {
        console.error(`❌ API call failed for ${day} with date ${finalDateString}:`, apiError);
        console.error(`❌ Error details:`, apiError instanceof Error ? apiError.message : String(apiError));
        throw apiError; // Re-throw to be caught by outer catch
      }
      const themeWords = (data as { theme?: { words?: string[] } })?.theme?.words || [];
      const themeName = (data as { theme?: { name?: string } })?.theme?.name || 'Unknown';
      const returnedDate = (data as { date?: string })?.date || 'unknown';
      console.log(`✅ Theme name returned for ${day}: ${themeName}`);
      console.log(`✅ Date returned from backend: ${returnedDate}`);
      console.log(`✅ Theme words returned for ${day} (${themeWords.length} words):`, themeWords.slice(0, 5));
      
      // Verify the backend returned the correct theme for this day
      const expectedThemeNames: Record<string, string> = {
        monday: 'Food & Drinks',
        tuesday: 'Common Nouns',
        wednesday: 'Nature',
        thursday: 'Adjectives',
        friday: 'Animals',
        saturday: 'Colors',
        sunday: 'Actions'
      };
      const expectedTheme = expectedThemeNames[day];
      
      // Log verification but don't block - trust the backend response
      if (returnedDate !== finalDateString) {
        console.warn(`⚠️ Date mismatch: Requested ${finalDateString} but backend returned ${returnedDate}`);
      }
      
      // Log theme verification but don't block - backend should be correct now
      if (themeName !== expectedTheme) {
        console.warn(`⚠️ Theme mismatch for ${day}: Expected "${expectedTheme}" but got "${themeName}"`);
        console.warn(`⚠️ Requested date: ${finalDateString}, Returned date: ${returnedDate}`);
      } else {
        console.log(`✅ Theme verification passed for ${day}: ${themeName}`);
      }
      
      console.log(`✅ Saving theme data for ${day}: date=${returnedDate}, theme=${themeName}`);
      console.log(`✅ Data success flag:`, data.success);
      console.log(`✅ Data keys:`, Object.keys(data));
      
      if (data.success) {
        // Store the complete theme data with a safe merge of found flags (never un-find a word)
        setThemeAnalytics(prev => {
          const incoming = data as Record<string, unknown>;
          const merged: Record<string, unknown> = { ...incoming };
          try {
            const incomingAll = Array.isArray(incoming?.allThemeWords) ? (incoming!.allThemeWords as Array<string | { word?: string; found?: boolean }>) : [];

            // Trust the backend completely - use found flags directly from backend response
            // The backend filters out stale data, so we should trust it completely
            if (incomingAll.length) {
              // Use the found flags directly from the backend response
              merged.allThemeWords = incomingAll.map(w => {
                if (typeof w === 'string') {
                  // If it's a string, check if backend marked it as found in stats
                  const lower = w.trim().toLowerCase();
                  const statsFound = (incoming as { stats?: { totalThemeWordsFound?: number; wordsFound?: string[] } })?.stats;
                  const isFound = Array.isArray(statsFound?.wordsFound) 
                    ? statsFound!.wordsFound!.some(fw => (fw || '').trim().toLowerCase() === lower)
                    : false;
                  return isFound ? { word: w, found: true } : { word: w, found: false };
                }
                // If it's an object, use the found flag from backend (backend is source of truth)
                return { ...w, found: !!w.found };
              });
            }
          } catch (mergeErr) {
            console.warn('⚠️ Theme merge warning:', mergeErr);
          }
          // Also store theme words for card display
          if (merged.theme && Array.isArray((merged.theme as { words?: string[] }).words)) {
            merged[`${day}_themeWords`] = (merged.theme as { words: string[] }).words;
          }
          
          const updated = { ...(prev || {}), [`${day}_themeDetails`]: merged } as Record<string, unknown>;
          // Also store theme words at the root level for getProgressFor
          if (merged.theme && Array.isArray((merged.theme as { words?: string[] }).words)) {
            updated[`${day}_themeWords`] = (merged.theme as { words: string[] }).words;
          }
          console.log(`🎯 Merged themeAnalytics for ${day}:`, {
            themeName: (merged.theme as { name?: string })?.name,
            wordsCount: Array.isArray((merged.theme as { words?: string[] })?.words) ? (merged.theme as { words: string[] }).words.length : 0,
            firstWords: Array.isArray((merged.theme as { words?: string[] })?.words) ? (merged.theme as { words: string[] }).words.slice(0, 3) : []
          });
          return updated;
        });
      } else {
        console.error(`❌ No theme data in response for ${day}. Response:`, data);
        console.error(`❌ Response structure:`, {
          hasSuccess: 'success' in data,
          successValue: data.success,
          hasTheme: 'theme' in data,
          hasDate: 'date' in data,
          allKeys: Object.keys(data)
        });
      }
    } catch (error) {
      console.error(`❌ Error fetching theme day details for ${day}:`, error);
      console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      
      // If authentication failed, show a message to the user
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        console.log('🔐 Authentication failed - user may need to sign in again');
        return;
      }
      
      // For other errors, show a fallback message
      console.log('⚠️ Using fallback theme words due to API error');
      // Don't return here - let the modal stay open so user can see the error
    }
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
    <div className="max-w-6xl mx-auto py-6 sm:py-8 md:py-10 px-3 sm:px-4">
      {/* Fixed Logout floating button to guarantee visibility */}
      <div className="fixed top-4 right-4 z-[100] group">
        <button
          onClick={async () => { try { await apiService.signOut(); } catch {} ; router.push('/signin'); }}
          aria-label="Sign out"
          className="w-10 h-10 rounded-full border-2 border-red-500 bg-red-400 hover:bg-red-500 shadow-lg flex items-center justify-center transition-all"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
          </svg>
        </button>
        {/* Tooltip */}
        <div className="absolute right-0 top-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded py-1.5 px-2 whitespace-nowrap shadow-lg">
            Sign out
            <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 transform rotate-45"></div>
          </div>
        </div>
      </div>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-[3px] mb-6 sm:mb-8 shadow-xl sm:shadow-2xl sticky top-0 z-30">
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white/95 to-blue-50/95 text-blue-900 p-4 sm:p-6 md:p-8 backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6 md:gap-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28">
                  {profile.profileImageUrl && profile.profileImageUrl.trim() !== '' ? (
                    <Image
                      src={profile.profileImageUrl}
                      alt="Profile"
                      width={112}
                      height={112}
                      className="rounded-full border-4 border-white shadow-2xl w-full h-full object-cover"
                      onError={() => {
                        console.error('Profile image failed to load:', profile.profileImageUrl);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-bold text-white shadow-2xl">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                  {profile.username}
                </h1>
                <p className="text-blue-600 text-lg font-medium mb-4">{profile.email}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                    Level {profile.highestLevel}
                  </span>
                  <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                    Win Rate {winRate(profile)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-end gap-4">
              <button 
                onClick={openAiModal}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white px-8 py-4 rounded-2xl hover:scale-105 transition-all duration-300 font-bold shadow-2xl flex items-center gap-4 hover:shadow-3xl border-2 border-emerald-400/30 hover:border-emerald-300/50 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <svg className="h-6 w-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-black text-white drop-shadow-2xl">Ask Lexi</div>
                    <div className="text-base font-bold text-white drop-shadow-lg">Your WordFlect Assistant</div>
                  </div>
                </div>
              </button>
              
              {/* Lexi Helper Popup */}
              {showLexiPopup && (
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 z-50 animate-bounce-in">
                  <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black border border-emerald-500/30 rounded-2xl p-6 shadow-2xl max-w-sm relative">
                    {/* Close button */}
                    <button
                      onClick={handleLexiPopupClose}
                      className="absolute top-3 right-3 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors duration-200"
                    >
                      <span className="text-white font-bold text-lg leading-none">×</span>
                    </button>
                    
                    {/* Content */}
                    <div className="pr-8">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">Meet Lexi!</h3>
                          <p className="text-emerald-300 text-sm font-medium">Your AI Assistant</p>
                        </div>
                      </div>
                      
                      <p className="text-white/90 text-sm leading-relaxed mb-4">
                        Ask me anything about your stats, gameplay tips, or navigation! I can help you understand your progress and guide you through WordFlect.
                      </p>
                      
                      <div className="flex items-center gap-2 text-emerald-300 text-xs">
                        <span>💡</span>
                        <span>Try: &quot;How many words did I find today?&quot;</span>
                      </div>
                    </div>
                    
                    {/* Arrow pointing to Lexi button */}
                    <div className="absolute bottom-0 right-8 transform translate-y-full">
                      <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mission Reset Countdown */}
      <MissionResetCountdown variant="profile" className="mb-8" />

      {/* Calendar Modal */}
      <CalendarModal
        isOpen={calendarModal.isOpen}
        onClose={() => setCalendarModal((prev: typeof calendarModal) => ({ ...prev, isOpen: false }))}
        type={calendarModal.type!}
        title={calendarModal.title}
        data={calendarModal.data}
        startDate={calendarModal.startDate}
        endDate={calendarModal.endDate}
      />

      {/* Inspect Analytics Modal */}
      {isInspectOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden my-4">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-bold text-gray-900">Inspect Time Analytics</h3>
              <button onClick={() => setIsInspectOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-5 overflow-auto max-h-[70vh] text-sm">
              <pre className="whitespace-pre-wrap break-words text-gray-800">{
(() => {
  try {
    const ta = timeAnalytics as unknown as { timePeriods?: Record<string, { label?: string; wordCount?: number; gamesPlayed?: number; sessions?: { startTime?: string; timestamp?: string; duration?: number }[] }>, summary?: Record<string, unknown> };
    if (!ta || !ta.timePeriods) {
      return `No time analytics loaded.\n\nRaw API Response:\n${JSON.stringify(lastAnalyticsRaw, null, 2)}`;
    }
    const lines: string[] = [];
    lines.push('=== SUMMARY ===');
    lines.push(JSON.stringify(ta.summary || {}, null, 2));
    lines.push('\n=== PER-PERIOD STATS ===');
    Object.entries(ta.timePeriods).forEach(([key, p]) => {
      lines.push(`${key} (${p.label || ''}): words=${p.wordCount ?? 0}, games=${p.gamesPlayed ?? 0}, sessions=${p.sessions?.length ?? 0}`);
    });
    lines.push('\n=== RECENT SESSIONS (up to 12, real sessions only) ===');
    const allSessions = Object.values(ta.timePeriods).flatMap(p => p.sessions || []);
    // Filter out reconstructed sessions (identified by exact .000Z timestamps or reconstructed flag)
    const realSessions = allSessions.filter(s => {
      const ts = s.startTime || s.timestamp;
      if (!ts) return false;
      // Reconstructed sessions have .000Z (no milliseconds) and are exact times
      // Real sessions have millisecond precision
      const hasMs = ts.includes('.') && !ts.endsWith('.000Z');
      const hasReconstructedFlag = (s as Record<string, unknown>).reconstructed === true;
      return hasMs && !hasReconstructedFlag;
    });
    const recent = realSessions
      .map(s => ({ ts: new Date((s.startTime || s.timestamp) || ''), raw: s }))
      .filter(x => !isNaN(x.ts.getTime()))
      .sort((a,b) => b.ts.getTime() - a.ts.getTime())
      .slice(0, 12);
    if (recent.length === 0) {
      lines.push('No real sessions found (only reconstructed/estimated sessions available)');
    } else {
      recent.forEach((r, idx) => {
        const localHour = r.ts.getHours(); // Use local timezone for categorization
        const period = localHour <= 3 ? 'late-night' : localHour <= 8 ? 'early-morning' : localHour <= 12 ? 'late-morning' : localHour <= 17 ? 'afternoon' : 'evening';
        const localTime = r.ts.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: true });
        lines.push(`${idx+1}. ${r.ts.toISOString()} UTC (${localTime} EST/EDT) -> ${period} (local hour: ${localHour})`);
      });
    }
    return lines.join('\n');
  } catch (e) {
    return `Error rendering analytics: ${String(e)}\n\nRaw API Response:\n${JSON.stringify(lastAnalyticsRaw, null, 2)}`;
  }
})()
}</pre>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {aiModalOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Lexi - Your AI Assistant</h3>
              <div className="flex items-center gap-3">
                {/* Mute/Unmute Button */}
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    isMuted 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                  }`}
                  title={isMuted ? 'Enable audio' : 'Mute audio'}
                >
                  {isMuted ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
                
                {/* Close Button */}
                <button 
                  onClick={() => {
                    // Stop any current speech when closing modal
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                    setAiModalOpen(false);
                    setAiQuery('');
                    setAiResponse('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Hi! I&apos;m Lexi, your AI assistant. I can help with gameplay, stats, customization, and even navigation! Ask me to take you to the dashboard, sign you out, or open the WordFlect app. Try: &quot;How do I play?&quot;, &quot;Take me to dashboard&quot;, &quot;Open app&quot;, &quot;Sign me out&quot;, &quot;What are premium features?&quot;, or &quot;Give me some tips!&quot; Use Voice Ask for hands-free interaction!
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask about your stats..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                  ref={aiInputRef}
                />
                
                {/* Ask Buttons */}
                <div className="flex gap-3">
                  {/* Text Ask Button */}
                  <button
                    onClick={() => handleAiQuery()}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Text Ask
                  </button>
                  
                  {/* Voice Ask Button */}
                  {speechSupported ? (
                    <button
                      onClick={startListening}
                      disabled={isListening}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl ${
                        isListening 
                          ? 'bg-red-500 text-white cursor-not-allowed animate-pulse' 
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      {isListening ? 'Listening...' : 'Voice Ask'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-400 text-white rounded-xl cursor-not-allowed font-medium shadow-lg"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Voice Ask
                    </button>
                  )}
                </div>
                {/* Voice Response Button - Only show when there's a response */}
                {aiResponse && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => speakResponse()}
                      disabled={isSpeaking}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl ${
                        isSpeaking 
                          ? 'bg-orange-500 text-white cursor-not-allowed animate-pulse' 
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      {isSpeaking ? 'Speaking...' : 'Speak Response'}
                    </button>
                  </div>
                )}
                
                {!speechSupported && (
                  <div className="text-center text-xs text-gray-500 bg-gray-100 rounded-lg py-2">
                    Voice features require Chrome or Edge browser
                  </div>
                )}
              </div>
            </div>
            
            {aiResponse && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-700 mb-1">Lexi</div>
                    <p className="text-gray-800 font-medium">{aiResponse}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <MetricCard 
          title="Flectcoins" 
          value={profile.flectcoins.toLocaleString()} 
          accent="from-amber-400 to-yellow-500"
          onClick={() => {
            console.log('💰 Flectcoins card clicked!');
            setCurrencyModal({ isOpen: true, type: 'flectcoins' });
            fetchCurrencyHistory('flectcoins');
          }}
        />
        <MetricCard 
          title="Gems" 
          value={profile.gems.toLocaleString()} 
          accent="from-pink-400 to-rose-500"
          onClick={() => {
            console.log('💎 Gems card clicked!');
            setCurrencyModal({ isOpen: true, type: 'gems' });
            fetchCurrencyHistory('gems');
          }}
        />
      </div>

      {/* Deep Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Games and Top Score - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:col-span-2">
          {/* Games Card */}
          <div className="relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100 p-4">
            {/* Gradient background accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-10 rounded-bl-full" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-base text-blue-950">Games</h3>
              </div>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Games Played</p>
                  <p className="text-2xl font-extrabold text-gray-900">{profile.gamesPlayed.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Lifetime</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Top Score Card - Reduced size */}
          <div className="relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100 p-4">
            {/* Gradient background accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-10 rounded-bl-full" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600">Top Score</p>
                  <p className="text-2xl font-extrabold text-gray-900">{profile.topScore.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Best single game</p>
                </div>
              </div>
              {!!profile.topScore && profile.topScore > 0 && (
                <button
                  onClick={() => {
                    // Calculate top score history - show current top score + next 2 highest scores
                    // sessionHistory is not available on UserProfile
                    const sessionHistory: Array<{ score?: number; startTime?: string; endTime?: string }> = [];
                    
                    // Filter sessions with valid scores and dates
                    const validSessions = sessionHistory
                      .filter((session: { score?: number; startTime?: string; endTime?: string }) => {
                        const score = session.score || 0;
                        const date = session.startTime || session.endTime || '';
                        return score > 0 && date;
                      });
                    
                    // Create a map of unique scores to their earliest achievement date
                    const scoreToDateMap = new Map<number, string>();
                    
                    validSessions.forEach((session: { score?: number; startTime?: string; endTime?: string }) => {
                      const score = session.score || 0;
                      const date = session.startTime || session.endTime || '';
                      
                      if (!scoreToDateMap.has(score)) {
                        // First time we see this score, record it
                        scoreToDateMap.set(score, date);
                      } else {
                        // If we've seen this score before, keep the earliest date
                        const existingDate = scoreToDateMap.get(score) || '';
                        if (date && existingDate && new Date(date).getTime() < new Date(existingDate).getTime()) {
                          scoreToDateMap.set(score, date);
                        }
                      }
                    });
                    
                    // Get all unique scores and sort in descending order
                    const uniqueScores = Array.from(scoreToDateMap.keys()).sort((a, b) => b - a);
                    
                    // Get the current top score (should be the first one, but use profile.topScore as source of truth)
                    const currentTopScore = profile.topScore || (uniqueScores.length > 0 ? uniqueScores[0] : 0);
                    
                    // Find the date for the current top score
                    let topScoreDate = scoreToDateMap.get(currentTopScore) || null;
                    
                    // Fallback: if top score not in map, search validSessions directly
                    if (!topScoreDate) {
                      const topScoreSession = validSessions.find((session: { score?: number }) => 
                        session.score === currentTopScore
                      );
                      topScoreDate = topScoreSession?.startTime || (topScoreSession as { endTime?: string })?.endTime || null;
                    }
                    
                    // Get the next 2 highest scores (excluding the current top score)
                    const nextHighestScores = uniqueScores
                      .filter(score => score < currentTopScore)
                      .slice(0, 2)
                      .map(score => ({
                        score,
                        date: scoreToDateMap.get(score) || '',
                        replacedBy: undefined,
                        replacedDate: undefined,
                      }));
                    
                    setTopScoreModal({
                      isOpen: true,
                      score: currentTopScore,
                      date: topScoreDate,
                      title: 'Top Score (All Time)',
                      history: nextHighestScores, // Show next 2 highest scores
                    });
                  }}
                  className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                >
                  Click to view history
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Longest Word Card */}
        <PremiumStat
            title="Longest Word"
            value={profile.longestWord || longestRecentWord(profile) || "None"}
            subtitle="Record"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            gradient="from-purple-500 to-pink-600"
            clickable={!!(profile.longestWord || longestRecentWord(profile))}
            onClick={() => {
                // Find the longest word entry from allFoundWords to get its date
                const allWords = (profile.allFoundWords || []).filter(entry => {
                  if (typeof entry === 'string') return false;
                  return entry && entry.word && entry.date;
                }) as Array<{ word: string; date: string }>;
                
                const longestWordValue = profile.longestWord || longestRecentWord(profile);
                if (!longestWordValue || longestWordValue === "None") return;
                
                // Find the entry matching the longest word
                const longestEntry = allWords.find(entry => 
                  entry.word && entry.word.toUpperCase() === longestWordValue.toUpperCase()
                );
                
                // Calculate longest word history by processing words chronologically
                const history: Array<{ word: string; date: string; replacedBy?: string; replacedDate?: string }> = [];
                
                // Sort all words by date (chronologically)
                const sortedWords = [...allWords].sort((a, b) => {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  return dateA - dateB;
                });
                
                let currentLongest = '';
                let currentLongestDate = '';
                
                // Process words chronologically to track when longest word changed
                sortedWords.forEach(entry => {
                  const word = entry.word || '';
                  const entryDate = entry.date;
                  
                  if (!word || !entryDate) return;
                  
                  // If this word is longer than current longest, it becomes the new longest
                  if (word.length > currentLongest.length) {
                    // If we had a previous longest word, record it in history
                    if (currentLongest) {
                      history.push({
                        word: currentLongest,
                        date: currentLongestDate,
                        replacedBy: word,
                        replacedDate: entryDate,
                      });
                    }
                    currentLongest = word;
                    currentLongestDate = entryDate;
                  }
                });
                
                setLongWordModal({
                  isOpen: true,
                  word: longestWordValue,
                  date: longestEntry?.date || null,
                  title: 'Longest Word (All Time)',
                  history: history.reverse(), // Reverse to show most recent first
                });
              }}
            />
      </div>
      
      {/* Battle Performance and Leaderboard Podiums */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {/* Battle Performance - Premium Style */}
            <div className="relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100 p-6 transition-all duration-300">
              {/* Gradient background accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-10 rounded-bl-full z-0" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-600 opacity-5 rounded-tr-full z-0" />
              
              {/* Percentage and battle count in top right */}
              <div className="absolute top-6 right-6 flex flex-col items-end z-20">
                <span className="text-3xl font-extrabold text-emerald-600">{winRate(profile)}%</span>
                <span className="text-sm font-semibold text-gray-600 mt-0.5">Win Rate</span>
                <span className="text-lg font-bold text-gray-700 mt-1">{(profile.battleWins + profile.battleLosses).toLocaleString()} battles</span>
              </div>
              
              <div className="relative z-10">
                {/* Icon with gradient background */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                {/* Title */}
                <div className="mb-4 pr-32">
                  <h4 className="font-bold text-lg text-gray-900">Battle Performance</h4>
                </div>
                
                {/* Bars */}
                <div className="flex items-end justify-center gap-3" style={{ height: '160px' }}>
                  <Bar 
                    title="Wins" 
                    value={profile.battleWins} 
                    color="bg-emerald-500" 
                    total={Math.max(profile.battleWins, profile.battleLosses, 1)} 
                    onClick={() => {
                      setBattleModal({ isOpen: true, filter: 'wins' });
                    }}
                  />
                  <Bar 
                    title="Losses" 
                    value={profile.battleLosses} 
                    color="bg-rose-500" 
                    total={Math.max(profile.battleWins, profile.battleLosses, 1)} 
                    onClick={() => {
                      setBattleModal({ isOpen: true, filter: 'losses' });
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Leaderboard Podiums - Premium Style */}
            <div className="relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100 p-6 transition-all duration-300">
              {/* Gradient background accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500 to-yellow-600 opacity-10 rounded-bl-full z-0" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-600 opacity-5 rounded-tr-full z-0" />
              
              {/* Total count in top right */}
              <div className="absolute top-6 right-6 flex flex-col items-end z-20">
                <span className="text-3xl font-extrabold text-amber-600">{(profile.firstPlaceFinishes + profile.secondPlaceFinishes + profile.thirdPlaceFinishes).toLocaleString()}</span>
                <span className="text-sm font-semibold text-gray-600 mt-0.5">Total</span>
              </div>
              
              <div className="relative z-10">
                {/* Icon with gradient background */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 mb-4 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                
                {/* Title */}
                <div className="mb-4 pr-32">
                  <h4 className="font-bold text-lg text-gray-900">Leaderboard Podiums</h4>
                </div>
                
                {/* Bars */}
                <div className="flex items-end justify-center gap-3" style={{ height: '160px' }}>
                  <Bar 
                    title="🥇" 
                    value={profile.firstPlaceFinishes} 
                    color="bg-amber-500" 
                    total={Math.max(profile.firstPlaceFinishes, profile.secondPlaceFinishes, profile.thirdPlaceFinishes, 1)} 
                    onClick={() => {
                      setLeaderboardModal({ isOpen: true, filter: 'gold' });
                    }}
                  />
                  <Bar 
                    title="🥈" 
                    value={profile.secondPlaceFinishes} 
                    color="bg-gray-400" 
                    total={Math.max(profile.firstPlaceFinishes, profile.secondPlaceFinishes, profile.thirdPlaceFinishes, 1)} 
                    onClick={() => {
                      setLeaderboardModal({ isOpen: true, filter: 'silver' });
                    }}
                  />
                  <Bar 
                    title="🥉" 
                    value={profile.thirdPlaceFinishes} 
                    color="bg-orange-500" 
                    total={Math.max(profile.firstPlaceFinishes, profile.secondPlaceFinishes, profile.thirdPlaceFinishes, 1)} 
                    onClick={() => {
                      setLeaderboardModal({ isOpen: true, filter: 'bronze' });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
      
      {/* AI Insights */}
      <div className="bg-white rounded-xl p-5 shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg text-blue-950">AI Insights</h3>
              <p className="text-xs text-blue-700">On-device tips generated from your recent performance</p>
            </div>
          </div>
          <ul className="space-y-2 mb-6">
            {generateInsights(profile).map((tip, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-blue-900 text-sm">{tip}</span>
              </li>
            ))}
          </ul>
          
          {/* Activity Snapshot */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg text-blue-950">Activity Snapshot</h3>
                <p className="text-xs text-blue-700">Your recent activity overview</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-blue-900">
              {(() => {
                const now = new Date();
              const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              
              // Get recent games from sessionHistory or timeAnalytics as fallback
              let sessions = (detailedStats?.sessionHistory || []) as Array<{ 
                startTime?: string; 
                timestamp?: string; 
                level?: number;
                score?: number;
              }>;
              
              // Fallback: get sessions from timeAnalytics if sessionHistory is empty
              if (sessions.length === 0 && timeAnalytics && (timeAnalytics as Record<string, unknown>).timePeriods) {
                const timePeriods = (timeAnalytics as Record<string, unknown>).timePeriods as Record<string, { sessions?: Array<{ startTime?: string; timestamp?: string }> }>;
                const allSessions: Array<{ startTime?: string; timestamp?: string }> = [];
                Object.values(timePeriods).forEach(period => {
                  if (period?.sessions && Array.isArray(period.sessions)) {
                    allSessions.push(...period.sessions);
                  }
                });
                // Remove duplicates by timestamp
                const uniqueSessions = Array.from(new Map(
                  allSessions
                    .filter(s => s.startTime || s.timestamp)
                    .map(s => [s.startTime || s.timestamp || '', s])
                ).values());
                sessions = uniqueSessions;
                console.log('[Activity Snapshot] Using timeAnalytics sessions:', sessions.length);
              }
              
              // Debug: log session data
              console.log('[Activity Snapshot] Sessions count:', sessions.length);
              console.log('[Activity Snapshot] Sample session:', sessions[0]);
              console.log('[Activity Snapshot] detailedStats exists:', !!detailedStats);
              
              const recentGames = sessions.filter(s => {
                const sessionTime = s.startTime || s.timestamp;
                if (!sessionTime) return false;
                const sessionDate = new Date(sessionTime);
                // Validate date
                if (isNaN(sessionDate.getTime())) {
                  console.warn('[Activity Snapshot] Invalid session timestamp:', sessionTime);
                  return false;
                }
                
                // Filter out reconstructed sessions - they have exact .000Z timestamps (no milliseconds)
                // Real sessions have millisecond precision
                const isReconstructed = sessionTime.endsWith('.000Z') && sessionTime.includes('T') && sessionTime.split('T')[1].split('.')[0].match(/^\d{2}:\d{2}:(00|10|20|30|40|50)$/);
                if (isReconstructed) {
                  return false; // Skip reconstructed sessions
                }
                
                // Don't show future times - filter out any session that's more than 1 hour in the future
                const sessionTimestamp = sessionDate.getTime();
                const oneHourFromNow = now.getTime() + (60 * 60 * 1000);
                if (sessionTimestamp > oneHourFromNow) {
                  console.warn('[Activity Snapshot] Skipping future session:', sessionTime, 'local:', sessionDate.toLocaleString());
                  return false;
                }
                
                // Check if within last 24 hours (compare timestamps, not dates)
                const oneDayAgoTimestamp = oneDayAgo.getTime();
                const isRecent = sessionTimestamp >= oneDayAgoTimestamp;
                
                // Debug log for timezone issues
                if (isRecent) {
                  const localTimeStr = sessionDate.toLocaleString('en-US', {
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  console.log('[Activity Snapshot] Recent game found:', {
                    raw: sessionTime,
                    parsed: sessionDate.toISOString(),
                    local: localTimeStr,
                    timestamp: sessionTimestamp,
                    oneDayAgo: oneDayAgoTimestamp,
                    diffHours: (now.getTime() - sessionTimestamp) / (1000 * 60 * 60)
                  });
                }
                return isRecent;
              });
              
              console.log('[Activity Snapshot] Recent games count:', recentGames.length);
              
              // Get recent daily theme words - filter to only TODAY's words
              const themeWordsFoundToday: Array<{ word: string }> = [];
              const todaysThemeName = '';
              
              // Calculate today's date string (UTC to match backend)
              const today = new Date();
              const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
              
              // Filter themeWordsFoundToday by checking allFoundWords for TODAY's date
              if (profile && 'themeWordsFoundToday' in profile) {
                const rawThemeWords = (profile as { themeWordsFoundToday?: Array<string | { word: string }> }).themeWordsFoundToday || [];
                const allFoundWords = profile.allFoundWords || [];
                
                rawThemeWords.forEach(w => {
                  const word = typeof w === 'string' ? w : w.word;
                  if (!word) return;
                  
                  const wordUpper = word.toUpperCase();
                  
                  // Check if this word was found TODAY by looking in allFoundWords
                  const foundInAllWords = allFoundWords.find(entry => {
                    let entryWord: string;
                    if (typeof entry === 'string') {
                      entryWord = entry;
                    } else if (entry && typeof entry === 'object' && typeof entry.word === 'string') {
                      entryWord = entry.word;
                    } else {
                      return false;
                    }
                    
                    if (entryWord.toUpperCase() !== wordUpper) return false;
                    
                    // Check if the date matches today
                    if (typeof entry === 'object' && entry.date) {
                      const wordDate = new Date(entry.date).toISOString().split('T')[0];
                      return wordDate === todayString;
                    }
                    return false;
                  });
                  
                  // Only include if found TODAY
                  if (foundInAllWords && !themeWordsFoundToday.find(t => t.word === wordUpper)) {
                    themeWordsFoundToday.push({ word: wordUpper });
                  }
                });
              }
              
              // Get recent mission completions from transactionHistory (if available)
              const transactions = currencyHistory?.transactions || [];
              const recentMissions = transactions.filter(t => {
                if (t.reason !== 'mission_reward') return false;
                const txnDate = new Date(t.timestamp);
                return txnDate >= oneDayAgo;
              }).slice(0, 5); // Show up to 5 recent missions
              
              // Battle stats (cumulative, show recent activity count if we had battle history)
              const battlesPlayed = (profile?.battleWins || 0) + (profile?.battleLosses || 0);
              const battleWinRate = battlesPlayed > 0 
                ? Math.round(((profile?.battleWins || 0) / battlesPlayed) * 100) 
                : 0;
              
              const activities: Array<{ label: string; value: string; icon: string; onClick?: () => void; clickable?: boolean }> = [];
              
              // Recent games - always show, even if 0
              if (recentGames.length > 0) {
                activities.push({
                  label: 'Games Played',
                  value: `${recentGames.length} in last 24h`,
                  icon: '🎮'
                });
                
                // Show individual games with timestamps (up to 3 most recent)
                recentGames
                  .sort((a, b) => {
                    const timeA = new Date(a.startTime || a.timestamp || 0).getTime();
                    const timeB = new Date(b.startTime || b.timestamp || 0).getTime();
                    return timeB - timeA; // Most recent first
                  })
                  .slice(0, 3)
                  .forEach(game => {
                    const sessionTime = game.startTime || game.timestamp;
                    if (!sessionTime) return;
                    const gameTime = new Date(sessionTime);
                    // Check if date is valid
                    if (isNaN(gameTime.getTime())) {
                      console.warn('[Activity Snapshot] Invalid game timestamp:', sessionTime);
                      return;
                    }
                    // Format time in user's local timezone with date if needed
                    const now = new Date();
                    const gameDate = gameTime;
                    const isToday = gameDate.toDateString() === now.toDateString();
                    const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === gameDate.toDateString();
                    
                    let timeStr = gameTime.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true,
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    });
                    
                    // Add date context if not today
                    if (isYesterday) {
                      timeStr = `Yesterday ${timeStr}`;
                    } else if (!isToday) {
                      const dateStr = gameTime.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                      });
                      timeStr = `${dateStr} ${timeStr}`;
                    }
                    
                    activities.push({
                      label: '',
                      value: `  • ${timeStr}`,
                      icon: '🕐'
                    });
                  });
                
                if (recentGames.length > 3) {
                  activities.push({
                    label: '',
                    value: `  +${recentGames.length - 3} more`,
                    icon: ''
                  });
                }
              } else {
                // Show games played even if 0, but check if we have any games at all
                const totalSessions = sessions.length;
                if (totalSessions > 0) {
                  // User has played games, but none in last 24h
                  activities.push({
                    label: 'Games Played',
                    value: '0 in last 24h',
                    icon: '🎮'
                  });
                } else {
                  // No session history available or user hasn't played yet
                  activities.push({
                    label: 'Games Played',
                    value: 'No games yet',
                    icon: '🎮'
                  });
                }
              }
              
              // Recent found daily theme words
              if (themeWordsFoundToday.length > 0) {
                // Sort alphabetically since we don't have timestamps
                const sortedThemeWords = [...themeWordsFoundToday].sort((a, b) => a.word.localeCompare(b.word));
                
                activities.push({
                  label: 'Recent Found Daily Theme Words',
                  value: `${themeWordsFoundToday.length}${todaysThemeName ? ` (${todaysThemeName})` : ''}`,
                  icon: '🎯'
                });
                
                // Show individual theme words (up to 5)
                sortedThemeWords.slice(0, 5).forEach((entry) => {
                  activities.push({
                    label: '',
                    value: `  • ${entry.word}`,
                    icon: '⭐'
                  });
                });
                
                if (themeWordsFoundToday.length > 5) {
                  activities.push({
                    label: '',
                    value: `  +${themeWordsFoundToday.length - 5} more`,
                    icon: ''
                  });
                }
              }
              
              // Longest word of the day (found today)
              const todayWords = (profile.allFoundWords || []).filter(entry => {
                if (typeof entry === 'string') return false;
                if (!entry || typeof entry !== 'object') return false;
                if (!entry.date) return false;
                const entryDate = new Date(entry.date);
                if (isNaN(entryDate.getTime())) return false;
                const entryDateStr = entryDate.toISOString().split('T')[0];
                return entryDateStr === todayString;
              }) as Array<{ word: string; date: string }>;
              
              if (todayWords.length > 0) {
                const longestToday = todayWords.reduce((longest, entry) => {
                  const word = entry?.word || '';
                  const longestWord = longest?.word || '';
                  return word.length > longestWord.length ? entry : longest;
                }, null as { word: string; date: string } | null);
                
                if (longestToday && longestToday.word) {
                  activities.push({
                    label: 'Long Word of the Day',
                    value: longestToday.word,
                    icon: '📝',
                    onClick: () => {
                      setLongWordModal({
                        isOpen: true,
                        word: longestToday.word,
                        date: longestToday.date || null,
                        title: 'Long Word of the Day',
                        history: [], // No history for daily longest word
                      });
                    },
                    clickable: true
                  });
                }
              }
              
              // Mission completions - separate daily/weekly from global accomplishments
              const dailyWeeklyMissions = recentMissions.filter(m => 
                (m.metadata?.period as string) !== 'global'
              );
              const globalMissions = recentMissions.filter(m => 
                (m.metadata?.period as string) === 'global'
              );
              
              // Daily/Weekly missions
              if (dailyWeeklyMissions.length > 0) {
                const missionNames = new Map<string, string>();
                dailyWeeklyMissions.forEach(mission => {
                  const missionTitle = (mission.metadata?.missionTitle as string) || 'Mission Completed';
                  if (!missionNames.has(missionTitle)) {
                    missionNames.set(missionTitle, missionTitle);
                  }
                });
                
                if (dailyWeeklyMissions.length === 1) {
                  activities.push({
                    label: 'Mission Completed',
                    value: missionNames.values().next().value || 'Mission',
                    icon: '✅'
                  });
                } else {
                  activities.push({
                    label: 'Missions Completed',
                    value: `${dailyWeeklyMissions.length} missions`,
                    icon: '✅'
                  });
                  Array.from(missionNames.values()).slice(0, 3).forEach(missionName => {
                    activities.push({
                      label: '',
                      value: `  • ${missionName}`,
                      icon: '🎯'
                    });
                  });
                  if (missionNames.size > 3) {
                    activities.push({
                      label: '',
                      value: `  +${missionNames.size - 3} more`,
                      icon: ''
                    });
                  }
                }
              }
              
              // Global accomplishments (show all, even if older than 24h - they're rare achievements)
              const allGlobalMissions = transactions.filter(t => {
                if (t.reason !== 'mission_reward') return false;
                return (t.metadata?.period as string) === 'global';
              })
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 5); // Show 5 most recent global accomplishments
              
              if (allGlobalMissions.length > 0) {
                if (globalMissions.length > 0) {
                  // Show newly completed global accomplishments
                  activities.push({
                    label: 'Global Accomplishment',
                    value: globalMissions.length === 1 
                      ? (globalMissions[0].metadata?.missionTitle as string) || 'Achievement'
                      : `${globalMissions.length} achievements`,
                    icon: '🏆'
                  });
                  
                  if (globalMissions.length > 1) {
                    globalMissions.slice(0, 3).forEach(mission => {
                      const missionTitle = (mission.metadata?.missionTitle as string) || 'Achievement';
                      const missionTime = new Date(mission.timestamp);
                      const timeStr = missionTime.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      });
                      activities.push({
                        label: '',
                        value: `  • ${missionTitle} at ${timeStr}`,
                        icon: '⭐'
                      });
                    });
                    if (globalMissions.length > 3) {
                      activities.push({
                        label: '',
                        value: `  +${globalMissions.length - 3} more`,
                        icon: ''
                      });
                    }
                  }
                } else {
                  // Show most recent global accomplishment even if not from last 24h
                  const mostRecent = allGlobalMissions[0];
                  const missionTitle = (mostRecent.metadata?.missionTitle as string) || 'Achievement';
                  const missionTime = new Date(mostRecent.timestamp);
                  const daysAgo = Math.floor((now.getTime() - missionTime.getTime()) / (1000 * 60 * 60 * 24));
                  const timeStr = daysAgo === 0 
                    ? missionTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : daysAgo === 1 
                      ? 'Yesterday' 
                      : `${daysAgo} days ago`;
                  
                  activities.push({
                    label: 'Recent Accomplishment',
                    value: `${missionTitle} (${timeStr})`,
                    icon: '🏆'
                  });
                }
              }
              
              // Level
              activities.push({
                label: 'Current Level',
                value: `${profile?.highestLevel || 1}`,
                icon: '📈'
              });
              
              // Battle stats
              if (battlesPlayed > 0) {
                activities.push({
                  label: 'Battle Record',
                  value: `${profile?.battleWins || 0}W - ${profile?.battleLosses || 0}L (${battleWinRate}% win rate)`,
                  icon: '⚔️'
                });
              } else {
                activities.push({
                  label: 'Battles Played',
                  value: '0',
                  icon: '⚔️'
                });
              }
              
              // Subscription status
              const isPremium = (profile as { isPremium?: boolean }).isPremium || false;
              const subscriptionTier = (profile as { subscriptionTier?: string }).subscriptionTier;
              const subscriptionEndDate = (profile as { subscriptionEndDate?: string }).subscriptionEndDate;
              
              if (isPremium && subscriptionEndDate) {
                const endDate = new Date(subscriptionEndDate);
                const now = new Date();
                const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining > 0) {
                  const tierName = subscriptionTier || 'Premium';
                  activities.push({
                    label: 'Subscription',
                    value: `${tierName} (${daysRemaining} days left)`,
                    icon: '💎'
                  });
                }
              }
              
              // Recent purchases from transaction history (real money only, not flectcoin spending)
              const purchaseTransactions = transactions.filter(t => {
                const txnDate = new Date(t.timestamp);
                if (txnDate < oneDayAgo) return false;
                // Only show actual cash purchases: subscriptions, gems, flectcoins, frames, backgrounds
                // Exclude powerup purchases (hint_purchase, shuffle_purchase, etc.) - those are flectcoin spending, not cash purchases
                const cashPurchaseReasons = [
                  'subscription_purchase',
                  'subscription_renewal',
                  'gems_purchase',
                  'flectcoins_purchase',
                  'frame_purchase',
                  'background_purchase'
                ];
                return cashPurchaseReasons.includes(t.reason);
              }).slice(0, 5);
              
              if (purchaseTransactions.length > 0) {
                activities.push({
                  label: 'Recent Purchases',
                  value: `${purchaseTransactions.length} in last 24h`,
                  icon: '💳'
                });
                
                // Show individual purchases
                purchaseTransactions.slice(0, 3).forEach(purchase => {
                  const purchaseTime = new Date(purchase.timestamp);
                  const timeStr = purchaseTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  });
                  
                  let purchaseName = '';
                  if (purchase.reason === 'subscription_purchase') {
                    purchaseName = 'Subscription';
                  } else if (purchase.reason === 'gems_purchase') {
                    purchaseName = `Gems (${Math.abs(purchase.amount)})`;
                  } else if (purchase.reason === 'flectcoins_purchase') {
                    purchaseName = `Flectcoins (${Math.abs(purchase.amount)})`;
                  } else if (purchase.reason.includes('_purchase')) {
                    purchaseName = purchase.reason.replace('_purchase', '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                  } else {
                    purchaseName = 'Purchase';
                  }
                  
                  activities.push({
                    label: '',
                    value: `  • ${purchaseName} at ${timeStr}`,
                    icon: '🛒'
                  });
                });
                
                if (purchaseTransactions.length > 3) {
                  activities.push({
                    label: '',
                    value: `  +${purchaseTransactions.length - 3} more`,
                    icon: ''
                  });
                }
              }
              
              return (
                <div className="space-y-2.5">
                  {activities.map((activity, idx) => {
                    const isClickable = activity.clickable && activity.onClick;
                    const Component = isClickable ? 'button' : 'div';
                    return (
                      <Component
                        key={idx}
                        onClick={isClickable ? activity.onClick : undefined}
                        className={`flex items-center justify-between py-1 w-full ${isClickable ? 'cursor-pointer hover:bg-blue-50 rounded px-2 -mx-2 transition-colors' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{activity.icon}</span>
                          <span>{activity.label}</span>
                        </div>
                        <span className={`font-semibold text-blue-950 ${isClickable ? 'underline decoration-dotted' : ''}`}>{activity.value}</span>
                      </Component>
                    );
                  })}
                </div>
              );
            })()}
            </div>
          </div>
      </div>

      {/* History Graph */}
      <div className="bg-white rounded-xl p-5 shadow mb-6">
        {/* Header Section */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-blue-950">History</h3>
            <p className="text-sm text-blue-700">View your new word discovery trends over time</p>
            <p className="text-xs text-blue-600 mt-1">Note: Shows only newly discovered words (never found before). Historical total equals your total unique words.</p>
          </div>
        </div>
        
        {/* Date Range Filter Row */}
        <div className="mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:overflow-x-visible sm:pb-0 sm:mx-0">
            {(["7d","30d","90d","1y","all","custom"] as const).map(r => (
              <button key={r} onClick={() => {
                console.log(`🖱️ History range button clicked: ${r}`);
                setHistoryRange(r);
              }} className={`px-3 py-1.5 rounded text-sm border whitespace-nowrap flex-shrink-0 font-medium transition-colors ${historyRange===r? 'bg-blue-600 text-white border-blue-600':'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'}`}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="mb-4 text-xs text-blue-900/80 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500"></span>
            <span>History: first-time (unique) words per day</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-300"></span>
            <span>Tooltip lists new words; count is unique-first only</span>
          </span>
        </div>
        
        {/* Custom Date Range Picker */}
        {historyRange === "custom" && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={customHistoryDateRange.start}
                    onChange={(e) => setCustomHistoryDateRange(prev => ({ ...prev, start: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
              </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={customHistoryDateRange.end}
                    onChange={(e) => setCustomHistoryDateRange(prev => ({ ...prev, end: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      if (customHistoryDateRange.start && customHistoryDateRange.end) {
                        const startDate = new Date(customHistoryDateRange.start);
                        const endDate = new Date(customHistoryDateRange.end);
                        
                        // Validate dates
                        if (startDate > endDate) {
                          alert('Start date must be before end date');
                          return;
                        }
                        const now = new Date();
                        if (endDate > now) {
                          alert('End date cannot be in the future');
                          return;
                        }
                        
                        console.log('Custom range selected:', customHistoryDateRange);
                        // The useEffect will trigger when customDateRange changes
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                  >
                    Apply
                  </button>
                </div>
              </div>
              </div>
            )}
          
          {/* Date Range Display */}
          <div className="mb-4 text-center">
            <p className="text-sm text-blue-600 font-medium">
              {(() => {
                if (historyRange === "custom" && customHistoryDateRange.start && customHistoryDateRange.end) {
                  const startDate = new Date(customHistoryDateRange.start).toLocaleDateString();
                  const endDate = new Date(customHistoryDateRange.end).toLocaleDateString();
                  return `Custom Range: ${startDate} - ${endDate}`;
                } else if (historyRange === "7d") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 7);
                  return `Last 7 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (historyRange === "30d") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 30);
                  return `Last 30 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (historyRange === "90d") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 90);
                  return `Last 90 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (historyRange === "1y") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setFullYear(endDate.getFullYear() - 1);
                  return `Last Year: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (historyRange === "all") {
                  return "All Time Data";
                }
                return "Select a date range";
              })()}
            </p>
          </div>
          <LineChart data={(historyDays && historyDays.length > 0) ? historyDays : aggregated(profile).days} height={260} color="#4f46e5" wordsEmptyText="No new words" />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MiniStat title="Words (found)" value={profile.allFoundWords.length.toLocaleString()} />
            <MiniStat title="Avg/Day" value={historyMetrics.avgPerDay} />
            <MiniStat title="Avg Length" value={historyMetrics.avgLength.toFixed(1)} />
          </div>
      </div>

      {/* Game Words History */}
      <div className="mt-8 bg-white rounded-xl p-5 shadow-lg border border-green-100">
        {/* Header Section */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-green-950">Game Words History</h3>
            <p className="text-sm text-green-700">Total words found per day across all games. This shows your daily word discovery progress.</p>
          </div>
        </div>
        
        {/* Date Range Filter Row */}
        <div className="mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:overflow-x-visible sm:pb-0 sm:mx-0">
            {(["7d","30d","90d","1y","all","custom"] as const).map(r => (
              <button key={r} onClick={() => {
                console.log(`🖱️ Sessions range button clicked: ${r}`);
                setSessionsRange(r);
              }} className={`px-3 py-1.5 rounded text-sm border whitespace-nowrap flex-shrink-0 font-medium transition-colors ${sessionsRange===r? 'bg-green-600 text-white border-green-600':'bg-white text-green-800 border-green-200 hover:bg-green-50'}`}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="mb-4 text-xs text-green-900/80 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span>Games: all words found per day across games</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-300"></span>
            <span>Includes repeats; reflects total daily activity</span>
          </span>
        </div>
        
        {/* Custom Date Range Picker */}
        {sessionsRange === "custom" && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={customSessionsDateRange.start}
                    onChange={(e) => setCustomSessionsDateRange(prev => ({ ...prev, start: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                  />
            </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={customSessionsDateRange.end}
                  onChange={(e) => setCustomSessionsDateRange(prev => ({ ...prev, end: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => {
                    if (customSessionsDateRange.start && customSessionsDateRange.end) {
                      const startDate = new Date(customSessionsDateRange.start);
                      const endDate = new Date(customSessionsDateRange.end);
                      
                      // Validate dates
                      if (startDate > endDate) {
                        alert('Start date must be before end date');
                        return;
                      }
                      const now = new Date();
                      if (endDate > now) {
                        alert('End date cannot be in the future');
                        return;
                      }
                      
                      console.log('Custom range selected:', customSessionsDateRange);
                      // The useEffect will trigger when customDateRange changes
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Date Range Display */}
        <div className="mb-4 text-center">
          <p className="text-sm text-green-600 font-medium">
            {(() => {
              if (sessionsRange === "custom" && customSessionsDateRange.start && customSessionsDateRange.end) {
                const startDate = new Date(customSessionsDateRange.start).toLocaleDateString();
                const endDate = new Date(customSessionsDateRange.end).toLocaleDateString();
                return `Custom Range: ${startDate} - ${endDate}`;
              } else if (sessionsRange === "7d") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 7);
                return `Last 7 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (sessionsRange === "30d") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 30);
                return `Last 30 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (sessionsRange === "90d") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 90);
                return `Last 90 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (sessionsRange === "1y") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setFullYear(endDate.getFullYear() - 1);
                return `Last Year: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (sessionsRange === "all") {
                return "All Time Data";
              }
              return "Select a date range";
            })()}
          </p>
        </div>
        
        <LineChart data={sessionWordsDays || []} height={260} color="#10b981" wordsEmptyText="No games recorded" wordsPreFormatted={true} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          <MiniStat title="Session Words" value={sessionWordsDays ? sessionWordsDays.reduce((sum, day) => sum + day.value, 0).toLocaleString() : '0'} />
          <MiniStat title="Avg/Day" value={sessionWordsDays && sessionWordsDays.length > 0 ? Math.round(sessionWordsDays.reduce((sum, day) => sum + day.value, 0) / sessionWordsDays.length * 10) / 10 : 0} />
          <MiniStat title="Peak Day" value={sessionWordsDays && sessionWordsDays.length > 0 ? Math.max(...sessionWordsDays.map(d => d.value)) : 0} />
        </div>
      </div>
      {/* Time & Usage Analytics */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-lg border border-blue-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-xl text-blue-950">Time & Usage Analytics</h3>
            <p className="text-sm text-blue-700">Your engagement and playing patterns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Total Play Time */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs text-emerald-600 font-semibold">TOTAL TIME</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900">
              {(timeAnalytics?.summary as { totalPlayTimeFormatted?: string })?.totalPlayTimeFormatted || 
               (usageMetrics.totalPlayTimeMinutes !== undefined
                ? `${Math.floor((usageMetrics.totalPlayTimeMinutes) / 60)}h ${(usageMetrics.totalPlayTimeMinutes) % 60}m`
                : 'N/A')}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Across all sessions</p>
          </div>

          {/* Days Logged In */}
          <div 
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => openCalendarModal('days-active')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs text-blue-600 font-semibold">DAYS ACTIVE</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {usageMetrics.daysLoggedIn ?? 'N/A'}
            </p>
            <p className="text-xs text-blue-700 mt-1">Total days played</p>
          </div>

          {/* Current Streak */}
          <div 
            className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => openCalendarModal('current-streak')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xs text-orange-600 font-semibold">CURRENT STREAK</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">
              {usageMetrics.currentStreakDays ?? 'N/A'}
            </p>
            <p className="text-xs text-orange-700 mt-1">Consecutive days</p>
          </div>

          {/* Longest Streak */}
          <div 
            className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => openCalendarModal('best-streak')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <span className="text-xs text-purple-600 font-semibold">BEST STREAK</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {usageMetrics.longestStreakDays ?? 'N/A'}
            </p>
            <p className="text-xs text-purple-700 mt-1">Longest streak</p>
          </div>
        </div>

        {/* Additional Time Insights */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-900">Time Insights</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-gray-700">
                <strong>Avg. Session:</strong> {usageMetrics.avgSessionMinutes !== undefined ? `${usageMetrics.avgSessionMinutes}m` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700">
                <strong>Last Login:</strong> {usageMetrics.lastLoginAt
                  ? new Date(usageMetrics.lastLoginAt).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-gray-700">
                <strong>Consistency:</strong> {profile.daysLoggedIn && profile.gamesPlayed
                  ? `${Math.round((profile.daysLoggedIn / profile.gamesPlayed) * 100)}%`
                  : 'N/A'
                }
              </span>
            </div>
          </div>
          </div>
        </div>

      {/* Theme Analytics */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-lg border border-blue-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-xl text-blue-950">Theme Analytics</h3>
            <p className="text-sm text-blue-700">Track your performance across daily theme challenges</p>
            </div>
          </div>


        {/* Theme Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Monday - Food & Drinks */}
          {(() => {
            console.log('🎯 Monday card rendering - themeAnalytics:', themeAnalytics);
            console.log('🎯 Monday card rendering - isLoadingThemeAnalytics:', isLoadingThemeAnalytics);
            console.log('🎯 Monday card rendering - themeAnalytics keys:', themeAnalytics ? Object.keys(themeAnalytics) : 'null');
            
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`monday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-all duration-200" onClick={() => handleThemeDayClick('monday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🍕</span>
                    </div>
                    <span className="text-xs text-blue-600 font-semibold">MONDAY</span>
                  </div>
                  <p className="text-lg font-bold text-blue-700">Food & Drinks</p>
                  <div className="mt-3 text-center text-blue-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('monday');
            console.log('🎯 Monday card - themeData:', themeData);
            const progress = getProgressFor('monday');
            console.log('🎯 Monday card - progress:', progress);
            if (!themeData) {
              return (
                <div 
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('monday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🍕</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">MONDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-700">{getThemeName('monday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => { const p = getProgressFor('monday'); return p ? `${p.found}/${p.total} theme words` : 'No data available (tap to load)'; })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('monday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🍕</span>
                  </div>
                  <span className="text-xs text-orange-600 font-semibold">MONDAY</span>
                </div>
                <p className="text-lg font-bold text-orange-900">{getThemeName('monday')}</p>
                <p className="text-xs text-orange-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-orange-200 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-orange-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}

          {/* Tuesday - Common Nouns */}
          {(() => {
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`tuesday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 cursor-pointer hover:from-green-100 hover:to-green-200 transition-all duration-200" onClick={() => handleThemeDayClick('tuesday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📚</span>
                    </div>
                    <span className="text-xs text-green-600 font-semibold">TUESDAY</span>
                  </div>
                  <p className="text-lg font-bold text-green-700">Common Nouns</p>
                  <div className="mt-3 text-center text-green-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('tuesday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('tuesday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏠</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">TUESDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('tuesday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => {
                      const p = getProgressFor('tuesday');
                      return p ? `${p.found}/${p.total} theme words` : 'No data available';
                    })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('tuesday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🏠</span>
            </div>
                  <span className="text-xs text-blue-600 font-semibold">TUESDAY</span>
          </div>
                <p className="text-lg font-bold text-blue-900">{getThemeName('tuesday')}</p>
                <p className="text-xs text-blue-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}
          {/* Wednesday - Nature */}
          {(() => {
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`wednesday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 cursor-pointer hover:from-emerald-100 hover:to-emerald-200 transition-all duration-200" onClick={() => handleThemeDayClick('wednesday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🌿</span>
                    </div>
                    <span className="text-xs text-emerald-600 font-semibold">WEDNESDAY</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700">Nature</p>
                  <div className="mt-3 text-center text-emerald-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('wednesday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('wednesday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏃</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">WEDNESDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('wednesday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => {
                      const p = getProgressFor('wednesday');
                      return p ? `${p.found}/${p.total} theme words` : 'No data available';
                    })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('wednesday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🏃</span>
            </div>
                  <span className="text-xs text-green-600 font-semibold">WEDNESDAY</span>
          </div>
                <p className="text-lg font-bold text-green-900">{getThemeName('wednesday')}</p>
                <p className="text-xs text-green-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-green-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}

          </div>

        {/* Additional Theme Days */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Thursday - Adjectives */}
          {(() => {
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`thursday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 cursor-pointer hover:from-purple-100 hover:to-purple-200 transition-all duration-200" onClick={() => handleThemeDayClick('thursday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📝</span>
                    </div>
                    <span className="text-xs text-purple-600 font-semibold">THURSDAY</span>
                  </div>
                  <p className="text-lg font-bold text-purple-700">{getThemeName('thursday')}</p>
                  <div className="mt-3 text-center text-purple-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('thursday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('thursday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">📝</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">THURSDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-700">{getThemeName('thursday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => { const p = getProgressFor('thursday'); return p ? `${p.found}/${p.total} theme words` : 'No data available (tap to load)'; })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('thursday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">📝</span>
                  </div>
                  <span className="text-xs text-yellow-600 font-semibold">THURSDAY</span>
                </div>
                <p className="text-lg font-bold text-yellow-900">{getThemeName('thursday')}</p>
                <p className="text-xs text-yellow-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-yellow-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-yellow-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}

          {/* Friday - Animals */}
          {(() => {
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`friday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200 cursor-pointer hover:from-orange-100 hover:to-orange-200 transition-all duration-200" onClick={() => handleThemeDayClick('friday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🐕</span>
                    </div>
                    <span className="text-xs text-orange-600 font-semibold">FRIDAY</span>
                  </div>
                  <p className="text-lg font-bold text-orange-700">{getThemeName('friday')}</p>
                  <div className="mt-3 text-center text-orange-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('friday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('friday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🐕</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">FRIDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-700">{getThemeName('friday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => { const p = getProgressFor('friday'); return p ? `${p.found}/${p.total} theme words` : 'No data available (tap to load)'; })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('friday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🐕</span>
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">FRIDAY</span>
                </div>
                <p className="text-lg font-bold text-purple-900">{getThemeName('friday')}</p>
                <p className="text-xs text-purple-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}

          {/* Saturday - Colors */}
          {(() => {
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`saturday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 border border-pink-200 cursor-pointer hover:from-pink-100 hover:to-pink-200 transition-all duration-200" onClick={() => handleThemeDayClick('saturday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🎨</span>
                    </div>
                    <span className="text-xs text-pink-600 font-semibold">SATURDAY</span>
                  </div>
                  <p className="text-lg font-bold text-pink-700">{getThemeName('saturday')}</p>
                  <div className="mt-3 text-center text-pink-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('saturday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('saturday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🎨</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">SATURDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-700">{getThemeName('saturday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => { const p = getProgressFor('saturday'); return p ? `${p.found}/${p.total} theme words` : 'No data available (tap to load)'; })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('saturday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🎨</span>
                  </div>
                  <span className="text-xs text-teal-600 font-semibold">SATURDAY</span>
                </div>
                <p className="text-lg font-bold text-teal-900">{getThemeName('saturday')}</p>
                <p className="text-xs text-teal-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-teal-200 rounded-full h-2">
                    <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-teal-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}

          {/* Sunday - Actions */}
          {(() => {
            // Show "tap to load" for cards without data
            const hasData = themeAnalytics && themeAnalytics[`sunday_themeDetails`];
            if (!hasData) {
              return (
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200 cursor-pointer hover:from-red-100 hover:to-red-200 transition-all duration-200" onClick={() => handleThemeDayClick('sunday')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🏃</span>
                    </div>
                    <span className="text-xs text-red-600 font-semibold">SUNDAY</span>
                  </div>
                  <p className="text-lg font-bold text-red-700">{getThemeName('sunday')}</p>
                  <div className="mt-3 text-center text-red-600 text-sm font-medium">
                    Tap to load progress
                  </div>
                </div>
              );
            }
            
            const themeData = getThemeData('sunday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('sunday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏃</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">SUNDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-700">{getThemeName('sunday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => { const p = getProgressFor('sunday'); return p ? `${p.found}/${p.total} theme words` : 'No data available (tap to load)'; })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('sunday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🏃</span>
                  </div>
                  <span className="text-xs text-gray-600 font-semibold">SUNDAY</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{getThemeName('sunday')}</p>
                <p className="text-xs text-gray-700 mt-1">{themeData.wordsFound}/{themeData.totalWords} theme words found</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gray-500 h-2 rounded-full" style={{ width: `${themeData.completionPercent}%` }}></div>
                  </div>
                  <span className="text-xs text-gray-600 font-semibold">{themeData.completionPercent}%</span>
                </div>
              </div>
            );
          })()}
        </div>
        {/* Theme Performance Summary */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-semibold text-violet-900">Theme Performance Summary</h4>
            </div>
          </div>
          {(() => {
            const summary = getThemePerformanceSummary();
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-violet-800">
                    <strong>Best Theme:</strong> {summary.bestTheme.name} ({summary.bestTheme.day}) - {summary.bestTheme.percentage}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-violet-800">
                    <strong>Most Consistent:</strong> {summary.mostConsistent.name} ({summary.mostConsistent.day}) - {summary.mostConsistent.percentage} words
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-violet-800">
                    <strong>Total Theme Words:</strong> {summary.totalThemeWords} found
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* Performance by Time Period */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-lg border border-blue-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-xl text-blue-950">Performance by Time Period</h3>
            <p className="text-sm text-blue-700">Discover when your brain performs at its peak</p>
            <p className="text-sm text-gray-600 mt-2">Your word-finding performance across different times of day</p>
          </div>
        </div>

        {/* Time Period Performance Overview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {/* Refresh and Inspect buttons hidden for production */}
            {false && (
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (isRefreshingTimeAnalytics) return;
                  setIsRefreshingTimeAnalytics(true);
                  try {
                    console.log('🔄 Manual refresh of time analytics...');
                    const response = await apiService.getTimeAnalytics({ period: 'ALL' });
                    if (response && (response as Record<string, unknown>).analytics) {
                      const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
                      setTimeAnalytics(analytics);
                      console.log('✅ Time analytics manually refreshed');
                    }
                  } catch (e) {
                    console.error('❌ Manual refresh failed', e);
                  } finally {
                    setIsRefreshingTimeAnalytics(false);
                  }
                }}
                disabled={isRefreshingTimeAnalytics}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition ${isRefreshingTimeAnalytics ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'text-blue-700 border-blue-300 hover:bg-blue-50'}`}
                aria-label="Refresh time analytics"
              >
                <svg className={`w-4 h-4 ${isRefreshingTimeAnalytics ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0019 5l1 1M4 5l1-1A9 9 0 0119 19"/>
                </svg>
                {isRefreshingTimeAnalytics ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={async () => {
                  console.log('🔎 Inspect button clicked');
                  setIsInspectOpen(true);
                  setLastAnalyticsRaw({ status: 'loading...' });
                  try {
                    console.log('🔎 Fetching time analytics for inspection...');
                    const response = await apiService.getTimeAnalytics({ period: 'ALL' });
                    console.log('🔎 Inspect received response:', response);
                    setLastAnalyticsRaw(response);
                    if (response && (response as Record<string, unknown>).analytics) {
                      const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
                      console.log('🔎 Setting timeAnalytics from inspect:', analytics);
                      setTimeAnalytics(analytics);
                    } else {
                      console.warn('🔎 No analytics in response:', response);
                    }
                  } catch (e) {
                    console.error('🔎 Inspect error:', e);
                    setLastAnalyticsRaw({ error: String(e) });
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition"
                aria-label="Inspect analytics"
                title="Inspect analytics"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                </svg>
                Inspect
              </button>
            </div>
            )}
          </div>
          
          {/* Status Bar Legend */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <h4 className="font-semibold text-blue-900">Status Bar Guide</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <span className="text-blue-800"><strong>Peak performance!</strong> (90-100%) - Your best time period</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📈</span>
                <span className="text-blue-800"><strong>Strong performance</strong> (70-89%) - Very good performance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span className="text-blue-800"><strong>Good performance</strong> (50-69%) - Solid performance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📉</span>
                <span className="text-blue-800"><strong>Moderate performance</strong> (25-49%) - Decent performance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🌱</span>
                <span className="text-blue-800"><strong>Building momentum</strong> (1-24%) - Getting started</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">😴</span>
                <span className="text-blue-800"><strong>No activity</strong> (0%) - No words found</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-blue-700 italic">
              💡 The percentage shows how each time period compares to your personal best performance
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Late Night (12AM - 4AM) */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodData = getTimePeriodData('late-night') as any;
            console.log('🔄 Rendering late-night card with data:', periodData);
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleTimePeriodClick('late-night')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">LATE NIGHT</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">
                    {(() => {
                      const periods = timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined;
                      const backendLabel = periods?.['late-night']?.label;
                      return convertLabelToAmPm(backendLabel) || getLocalAmPmLabel('late-night');
                    })()}
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-indigo-700">Words Found:</span>
                      <span className="font-semibold text-indigo-900">{periodData?.wordsFound ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-indigo-700">Games Played:</span>
                      <span className="font-semibold text-indigo-900">{periodData?.gamesPlayed ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-indigo-700">Avg. per Game:</span>
                      <span className="font-semibold text-indigo-900">{periodData?.avgPerGame ?? 0}</span>
                    </div>
                    {periodData?.wordsFound > 0 && (periodData?.gamesPlayed ?? 0) === 0 && (
                      <p className="text-[11px] text-indigo-700">Words recorded without session data (from historical records).</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-full bg-indigo-200 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${periodData?.performance ?? 0}%` }}></div>
                    </div>
                    <span className="text-xs text-indigo-600 font-semibold">{periodData?.performance ?? 0}%</span>
                  </div>
                  <p className="text-xs text-indigo-700 mt-2">{periodData?.status ?? ''}</p>
                </div>
              );
            }
            const isCurrentPeriod = getCurrentTimePeriod() === 'late-night';
            return (
              <div className={`relative rounded-xl p-4 border-2 cursor-pointer transition-all duration-300 ${
                isCurrentPeriod 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-xl hover:shadow-2xl' 
                  : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 hover:shadow-lg hover:scale-105'
              }`}
                onClick={() => handleTimePeriodClick('late-night')}
              >
                {/* Status indicator dot for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 left-3 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Animated clock icon for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 right-3">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCurrentPeriod ? 'bg-blue-500' : 'bg-indigo-500'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      isCurrentPeriod ? 'text-blue-800' : 'text-indigo-600'
                    }`}>
                      LATE NIGHT
                    </span>
                    {isCurrentPeriod && (
                      <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full">
                        ● LIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-indigo-900">
                  {periodData?.label || (() => {
                    const periods = timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined;
                    return convertLabelToAmPm(periods?.['late-night']?.label) || getLocalAmPmLabel('late-night');
                  })()}
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-700">Words Found:</span>
                    <span className="font-semibold text-indigo-900">{periodData?.wordsFound ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-700">Games Played:</span>
                    <span className="font-semibold text-indigo-900">{periodData?.gamesPlayed ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-700">Avg. per Game:</span>
                    <span className="font-semibold text-indigo-900">{periodData?.avgPerGame ?? 0}</span>
                  </div>
                  {periodData?.wordsFound > 0 && (periodData?.gamesPlayed ?? 0) === 0 && (
                    <p className="text-[11px] text-indigo-700">Words recorded without session data (from historical records).</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-indigo-200 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${periodData?.performance ?? 0}%` }}></div>
                  </div>
                  <span className="text-xs text-indigo-600 font-semibold">{periodData?.performance ?? 0}%</span>
                </div>
                <p className="text-xs text-indigo-700 mt-2">{periodData?.status ?? ''}</p>
              </div>
            );
          })()}

          
          {/* Early Morning (5AM - 10AM) */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodData = getTimePeriodData('early-morning') as any;
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleTimePeriodClick('early-morning')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">EARLY MORNING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">
                    {(() => {
                      const periods = timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined;
                      const backendLabel = periods?.['early-morning']?.label;
                      return convertLabelToAmPm(backendLabel) || getLocalAmPmLabel('early-morning');
                    })()}
                  </p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            const isCurrentPeriod = getCurrentTimePeriod() === 'early-morning';
            return (
              <div className={`relative rounded-xl p-4 border-2 cursor-pointer transition-all duration-300 ${
                isCurrentPeriod 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-xl hover:shadow-2xl' 
                  : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 hover:shadow-lg hover:scale-105'
              }`}
                onClick={() => handleTimePeriodClick('early-morning')}
              >
                {/* Status indicator dot for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 left-3 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Animated clock icon for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 right-3">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCurrentPeriod ? 'bg-blue-500' : 'bg-amber-500'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      isCurrentPeriod ? 'text-blue-800' : 'text-amber-600'
                    }`}>
                      EARLY MORNING
                    </span>
                    {isCurrentPeriod && (
                      <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full">
                        ● LIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-amber-900">{periodData?.label || getLocalAmPmLabel('early-morning')}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Words Found:</span>
                    <span className="font-semibold text-amber-900">{periodData?.wordsFound ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Games Played:</span>
                    <span className="font-semibold text-amber-900">{periodData?.gamesPlayed ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Avg. per Game:</span>
                    <span className="font-semibold text-amber-900">{periodData?.avgPerGame ?? 0}</span>
                  </div>
                  {periodData?.wordsFound > 0 && (periodData?.gamesPlayed ?? 0) === 0 && (
                    <p className="text-[11px] text-amber-700">Words recorded without session data (from historical records).</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-amber-200 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${periodData?.performance ?? 0}%` }}></div>
                  </div>
                  <span className="text-xs text-amber-600 font-semibold">{periodData?.performance ?? 0}%</span>
                </div>
                <p className="text-xs text-amber-700 mt-2">{periodData?.status ?? ''}</p>
              </div>
            );
          })()}
          {/* Late Morning (10AM - 3PM) */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodData = getTimePeriodData('late-morning') as any;
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleTimePeriodClick('late-morning')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">LATE MORNING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">
                    {(() => {
                      const periods = timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined;
                      const backendLabel = periods?.['late-morning']?.label;
                      return convertLabelToAmPm(backendLabel) || getLocalAmPmLabel('late-morning');
                    })()}
                  </p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            const isCurrentPeriod = getCurrentTimePeriod() === 'late-morning';
            return (
              <div className={`relative rounded-xl p-4 border-2 cursor-pointer transition-all duration-300 ${
                isCurrentPeriod 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-xl hover:shadow-2xl' 
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-lg hover:scale-105'
              }`}
                onClick={() => handleTimePeriodClick('late-morning')}
              >
                {/* Status indicator dot for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 left-3 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Animated clock icon for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 right-3">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCurrentPeriod ? 'bg-blue-500' : 'bg-blue-500'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      isCurrentPeriod ? 'text-blue-800' : 'text-blue-600'
                    }`}>
                      LATE MORNING
                    </span>
                    {isCurrentPeriod && (
                      <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full">
                        ● LIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-blue-900">{periodData?.label || getLocalAmPmLabel('late-morning')}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Words Found:</span>
                    <span className="font-semibold text-blue-900">{periodData?.wordsFound ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Games Played:</span>
                    <span className="font-semibold text-blue-900">{periodData?.gamesPlayed ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Avg. per Game:</span>
                    <span className="font-semibold text-blue-900">{periodData?.avgPerGame ?? 0}</span>
                  </div>
                  {periodData?.wordsFound > 0 && (periodData?.gamesPlayed ?? 0) === 0 && (
                    <p className="text-[11px] text-blue-700">Words recorded without session data (from historical records).</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${periodData?.performance ?? 0}%` }}></div>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold">{periodData?.performance ?? 0}%</span>
                </div>
                <p className="text-xs text-blue-700 mt-2">{periodData?.status ?? ''}</p>
              </div>
            );
          })()}

          {/* Afternoon (3PM - 8PM) */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodData = getTimePeriodData('afternoon') as any;
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleTimePeriodClick('afternoon')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">AFTERNOON</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">
                    {(() => {
                      const periods = timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined;
                      const backendLabel = periods?.['afternoon']?.label;
                      return convertLabelToAmPm(backendLabel) || getLocalAmPmLabel('afternoon');
                    })()}
                  </p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            const isCurrentPeriod = getCurrentTimePeriod() === 'afternoon';
            return (
              <div className={`relative rounded-xl p-4 border-2 cursor-pointer transition-all duration-300 ${
                isCurrentPeriod 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-xl hover:shadow-2xl' 
                  : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-lg hover:scale-105'
              }`}
                onClick={() => handleTimePeriodClick('afternoon')}
              >
                {/* Status indicator dot for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 left-3 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Animated clock icon for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 right-3">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCurrentPeriod ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12 a4 4 0 1 1 -8 0 a4 4 0 1 1 8 0z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      isCurrentPeriod ? 'text-blue-800' : 'text-green-600'
                    }`}>
                      AFTERNOON
                    </span>
                    {isCurrentPeriod && (
                      <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full">
                        ● LIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-green-900">{periodData?.label || getLocalAmPmLabel('afternoon')}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Words Found:</span>
                    <span className="font-semibold text-green-900">{periodData?.wordsFound ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Games Played:</span>
                    <span className="font-semibold text-green-900">{periodData?.gamesPlayed ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Avg. per Game:</span>
                    <span className="font-semibold text-green-900">{periodData?.avgPerGame ?? 0}</span>
                  </div>
                  {periodData?.wordsFound > 0 && (periodData?.gamesPlayed ?? 0) === 0 && (
                    <p className="text-[11px] text-green-700">Words recorded without session data (from historical records).</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${periodData?.performance ?? 0}%` }}></div>
                  </div>
                  <span className="text-xs text-green-600 font-semibold">{periodData?.performance ?? 0}%</span>
                </div>
                <p className="text-xs text-green-700 mt-2">{periodData?.status ?? ''}</p>
              </div>
            );
          })()}

          {/* Evening (8PM - 12AM) */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodData = getTimePeriodData('evening') as any;
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleTimePeriodClick('evening')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">EVENING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">
                    {(() => {
                      const periods = timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined;
                      const backendLabel = periods?.['evening']?.label;
                      return convertLabelToAmPm(backendLabel) || getLocalAmPmLabel('evening');
                    })()}
                  </p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            const isCurrentPeriod = getCurrentTimePeriod() === 'evening';
            return (
              <div className={`relative rounded-xl p-4 border-2 cursor-pointer transition-all duration-300 ${
                isCurrentPeriod 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-xl hover:shadow-2xl' 
                  : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-lg hover:scale-105'
              }`}
                onClick={() => handleTimePeriodClick('evening')}
              >
                {/* Status indicator dot for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 left-3 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Animated clock icon for current period */}
                {isCurrentPeriod && (
                  <div className="absolute top-3 right-3">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCurrentPeriod ? 'bg-blue-500' : 'bg-purple-500'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      isCurrentPeriod ? 'text-blue-800' : 'text-purple-600'
                    }`}>
                      EVENING
                    </span>
                    {isCurrentPeriod && (
                      <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full">
                        ● LIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-purple-900">{periodData?.label || getLocalAmPmLabel('evening')}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Words Found:</span>
                    <span className="font-semibold text-purple-900">{periodData?.wordsFound ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Games Played:</span>
                    <span className="font-semibold text-purple-900">{periodData?.gamesPlayed ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Avg. per Game:</span>
                    <span className="font-semibold text-purple-900">{periodData?.avgPerGame ?? '-'}</span>
                  </div>
                  {periodData?.wordsFound > 0 && (periodData?.gamesPlayed ?? 0) === 0 && (
                    <p className="text-[11px] text-purple-700">Words recorded without session data (from historical records).</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${periodData?.performance ?? 0}%` }}></div>
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">{periodData?.performance ?? 0}%</span>
                </div>
                <p className="text-xs text-purple-700 mt-2">{periodData?.status ?? ''}</p>
              </div>
            );
          })()}
        </div>

        {/* Performance Insights */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="font-semibold text-amber-900">Performance Insights</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-amber-800">
                <strong>Peak Time:</strong> {(() => {
                  const periods = ['late-night', 'early-morning', 'late-morning', 'afternoon', 'evening'];
                  const periodNames = periods.map(p => getLocalAmPmLabel(p));
                  let maxWords = 0;
                  let peakPeriod = 'No data';
                  
                  periods.forEach((period, index) => {
                    const data = getTimePeriodData(period);
                    if (data && data.wordsFound > maxWords) {
                      maxWords = data.wordsFound;
                      peakPeriod = periodNames[index];
                    }
                  });
                  
                  return `${peakPeriod} (${maxWords} words)`;
                })()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-amber-800">
                <strong>Best Session:</strong> {(() => {
                  const periods = ['late-night', 'early-morning', 'late-morning', 'afternoon', 'evening'];
                  let maxAvg = 0;
                  
                  periods.forEach(period => {
                    const data = getTimePeriodData(period);
                    if (data && data.avgPerGame > maxAvg) {
                      maxAvg = data.avgPerGame;
                    }
                  });
                  
                  return `${maxAvg} words per game average`;
                })()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-amber-800">
                <strong>Recommendation:</strong> {(() => {
                  const periods = ['late-night', 'early-morning', 'late-morning', 'afternoon', 'evening'];
                  const periodNames = ['late night', 'early morning', 'late morning', 'afternoon', 'evening'];
                  let maxWords = 0;
                  let bestPeriod = 0;
                  
                  periods.forEach((period, index) => {
                    const data = getTimePeriodData(period);
                    if (data && data.wordsFound > maxWords) {
                      maxWords = data.wordsFound;
                      bestPeriod = index;
                    }
                  });
                  
                  return maxWords > 0 ? `Play more ${periodNames[bestPeriod]} games!` : 'Start playing to see insights!';
                })()}
              </span>
            </div>
          </div>
        </div>
        {/* Time Period Analysis Chart */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-900">Performance Trend</h4>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="space-y-3">
            {(() => {
              const periods = [
                { key: 'late-night', color: 'indigo' },
                { key: 'early-morning', color: 'amber' },
                { key: 'late-morning', color: 'blue' },
                { key: 'afternoon', color: 'green' },
                { key: 'evening', color: 'purple' }
              ];
              
              return periods.map(period => {
                const data = getTimePeriodData(period.key);
                if (!data) return null;
                
                // Get label from backend data and convert to AM/PM format
                const backendPeriodData = (timeAnalytics?.timePeriods as Record<string, { label?: string }> | undefined)?.[period.key];
                const backendLabel = backendPeriodData?.label || '';
                const localLabel = backendLabel ? convertLabelToAmPm(backendLabel) : '';
                
                const maxWords = Math.max(...periods.map(p => {
                  const pData = getTimePeriodData(p.key);
                  return pData ? pData.wordsFound : 0;
                }), 1);
                const width = maxWords > 0 ? (data.wordsFound / maxWords) * 100 : 0;
                
                return (
                  <div key={period.key} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-gray-600">{localLabel || `${period.key}`}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div 
                        className={`bg-${period.color}-500 h-4 rounded-full flex items-center justify-end pr-2`} 
                        style={{ width: `${width}%` }}
                      >
                        <span className="text-xs text-white font-semibold">{data.wordsFound}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              <strong>Total Words Found:</strong> {(() => {
                const periods = ['late-night', 'early-morning', 'late-morning', 'afternoon', 'evening'];
                const total = periods.reduce((sum, period) => {
                  const data = getTimePeriodData(period);
                  return sum + (data ? data.wordsFound : 0);
                }, 0);
                return `${total} across all time periods`;
              })()}
            </p>
            
            {/* Data Limitation Notice */}
            {(timeAnalytics?.summary as { hasLimitedSessionData?: boolean })?.hasLimitedSessionData && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm text-amber-800 font-medium">Limited Historical Data</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Time period analysis is based on recent sessions only. Your lifetime total is 
                      {(timeAnalytics?.summary as { lifetimeGamesPlayed?: number })?.lifetimeGamesPlayed} games, 
                      but only 
                      {(timeAnalytics?.summary as { recentSessionsAnalyzed?: number })?.recentSessionsAnalyzed} recent sessions are available for time period analysis.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactivity: Words Explorer (Accordion Modal) */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-lg border border-blue-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-blue-950">Words Explorer</h3>
            <p className="text-sm text-blue-700">Browse and explore all your discovered words organized by letter</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => downloadCsv(aggregated(profile).filtered)} 
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button 
              onClick={() => setIsExplorerOpen(true)} 
              className="px-6 py-3 rounded-lg text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore Words
            </button>
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Interactive Word Browser</p>
              <p className="text-xs text-blue-700">Click &quot;Explore Words&quot; to open a modal where you can browse all your words organized by starting letter (A-Z), see when you first found each word, and track how many times you&apos;ve discovered them.</p>
            </div>
          </div>
        </div>
      </div>

      {isExplorerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsExplorerOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden border border-gray-200 my-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-xl text-white">Words Explorer</h4>
                    <p className="text-indigo-100 text-sm">Browse your discovered words by letter</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsExplorerOpen(false)} 
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(95vh-80px)] bg-gray-50">
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
                  <div className="space-y-4">
                    {letters.map(l => (
                      <div key={l} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                        <button 
                          onClick={() => toggle(l)} 
                          className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-200 ${
                            expandedLetters[l] 
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                              : 'bg-white hover:bg-gray-50 text-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                              expandedLetters[l] 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700'
                            }`}>
                              {l}
                            </div>
                            <div className="text-left">
                              <span className="font-bold text-lg">Letter {l}</span>
                              <p className={`text-sm ${expandedLetters[l] ? 'text-indigo-100' : 'text-gray-600'}`}>
                                {groups[l].length} words discovered
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              expandedLetters[l] 
                                ? 'bg-white/20 text-white' 
                                : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {groups[l].length}
                            </span>
                            <svg 
                              className={`w-5 h-5 transition-transform duration-200 ${
                                expandedLetters[l] ? 'rotate-180' : ''
                              }`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {expandedLetters[l] && (
                          <div className="bg-white border-t border-gray-100">
                            <div className="overflow-x-auto max-h-80 overflow-y-auto">
                              <table className="min-w-full">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr className="text-gray-700">
                                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Word</th>
                                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">First Found</th>
                                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Most Recent</th>
                                    <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider">Times Found</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {groups[l].map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                                      <td className="px-6 py-4">
                                        <span className="font-semibold text-gray-900 text-lg">{row.word}</span>
                                      </td>
                                      <td className="px-6 py-4 text-gray-700">
                                        <div className="flex items-center gap-2">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          {row.first.toLocaleDateString('en-US', { 
                                            year: 'numeric', 
                                            month: '2-digit', 
                                            day: '2-digit',
                                            timeZone: 'UTC'
                                          })}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-gray-700">
                                        <div className="flex items-center gap-2">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          {row.last.toLocaleDateString('en-US', { 
                                            year: 'numeric', 
                                            month: '2-digit', 
                                            day: '2-digit',
                                            timeZone: 'UTC'
                                          })}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
                                          {row.count} {row.count === 1 ? 'time' : 'times'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
            </div>
          </div>
        )}
      </div>
                    ))}
                    {!letters.length && (
                      <div className="text-center py-16">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No words discovered yet</h3>
                        <p className="text-gray-600 mb-6">Start playing Wordflect to discover amazing words!</p>
                        <button 
                          onClick={() => setIsExplorerOpen(false)}
                          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-semibold"
                        >
                          Start Playing
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Theme Words / Time Analytics Modal */}
      {isThemeModalOpen && selectedThemeDay && (() => {
        console.log('🎯 MODAL RENDERING - isThemeModalOpen:', isThemeModalOpen, 'selectedThemeDay:', selectedThemeDay);
        
        // Check if this is a time period (not a theme day)
        const timePeriods = ['late-night', 'early-morning', 'late-morning', 'afternoon', 'evening'];
        const isTimePeriod = timePeriods.includes(selectedThemeDay);
        
        if (isTimePeriod) {
          console.log('🕐 MODAL RENDERING - Time period detected:', selectedThemeDay);
          const periodData = getTimePeriodData(selectedThemeDay);
          console.log('🕐 MODAL RENDERING - Period data:', periodData);
          
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 capitalize">
                      {selectedThemeDay.replace('-', ' ')} Performance
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {periodData ? `${periodData.wordsFound} words found, ${periodData.gamesPlayed} games played` : 'No data available'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsThemeModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {!periodData ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No data available</h3>
                      <p className="text-gray-600 mb-4">No activity recorded for this time period.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Time Period Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-blue-600">{periodData.wordsFound}</div>
                          <div className="text-sm text-blue-800">Words Found</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">{periodData.gamesPlayed}</div>
                          <div className="text-sm text-green-800">Games Played</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-purple-600">{periodData.avgPerGame}</div>
                          <div className="text-sm text-purple-800">Avg Words/Game</div>
                        </div>
                      </div>
                      
                      {/* Time Period Description */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Time Period Details</h4>
                        <p className="text-gray-600 text-sm">
                          This shows your activity during the {selectedThemeDay.replace('-', ' ')} time period.
                          All words found during this time are included, not just theme words.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
        
        // Original theme words modal logic
        console.log('🎯 MODAL RENDERING - themeAnalytics keys:', Object.keys(themeAnalytics || {}));
        console.log('🎯 MODAL RENDERING - looking for key:', `${selectedThemeDay}_themeDetails`);
        console.log('🎯 MODAL RENDERING - stored data:', themeAnalytics?.[`${selectedThemeDay}_themeDetails`]);
        
        // Force re-render when data becomes available
        const themeDetails = themeAnalytics?.[`${selectedThemeDay}_themeDetails`];
        if (!themeDetails) {
          console.log('🎯 MODAL RENDERING - No data yet, showing loading...');
        } else {
          console.log('🎯 MODAL RENDERING - Data available, showing modal content!');
        }
        
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden my-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 capitalize">
                  {selectedThemeDay} Theme Words
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {(() => {
                    const themeData = getThemeData(selectedThemeDay);
                    if (!themeData) return 'No data available';
                    return `${themeData.wordsFound}/${themeData.totalWords} words found`;
                  })()}
                </p>
              </div>
              <button
                onClick={() => setIsThemeModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {(() => {
                console.log('🎯 MODAL CONTENT RENDERING - Starting modal content rendering logic');
                // Get complete theme details (support multiple backend shapes)
                const themeDetails = (themeAnalytics?.[`${selectedThemeDay}_themeDetails`] as ThemeDayResponse | null) || null;
                
                console.log('🎯 Modal debug - themeAnalytics keys:', Object.keys(themeAnalytics || {}));
                console.log('🎯 Modal debug - looking for key:', `${selectedThemeDay}_themeDetails`);
                console.log('🎯 Modal debug - themeDetails found:', themeDetails);
                console.log('🎯 Modal debug - themeDetails.success:', themeDetails?.success);
                console.log('🎯 Modal debug - themeDetails.theme:', themeDetails?.theme);
                console.log('🎯 Modal debug - themeDetails.progress:', themeDetails?.progress);
                
                console.log('🎯 Modal content - About to check if themeDetails exists and success is true');
                console.log('🎯 Modal content - themeDetails exists:', !!themeDetails);
                console.log('🎯 Modal content - themeDetails.success:', themeDetails?.success);
                
                console.log('🎯 Modal content - Checking condition: !themeDetails =', !themeDetails, ', !themeDetails.success =', !themeDetails?.success);
                console.log('🎯 Modal content - Will show loading?', (!themeDetails || !themeDetails.success));
                
                const tdSuccess = (themeDetails && typeof themeDetails === 'object' && 'success' in themeDetails) ? themeDetails.success === true : true;
                if (!themeDetails || !tdSuccess) {
                  console.log('🎯 Modal content - No themeDetails or success=false, showing loading state');
                  console.log('🎯 Modal content - themeDetails:', themeDetails);
                  console.log('🎯 Modal content - themeDetails?.success:', themeDetails?.success);
                  return (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Theme details loading...</h3>
                      <p className="text-gray-600 mb-4">Fetching theme details for {selectedThemeDay} from the server...</p>
                      <p className="text-sm text-gray-500">If this persists, please check your internet connection or try refreshing the page.</p>
                    </div>
                  );
                }
                
                console.log('🎯 Modal content - themeDetails found, proceeding to render content');
                
                // Derive words and found lists robustly
                const themeObj = themeDetails?.theme || {} as ThemeDayTheme;
                let allThemeWords: string[] = Array.isArray(themeObj?.words) ? themeObj.words : [];
                const statsObj = themeDetails?.stats || {} as ThemeDayStats;
                const allThemeWordsDetailed = themeDetails?.allThemeWords;
                if (Array.isArray(allThemeWordsDetailed)) {
                  allThemeWords = allThemeWordsDetailed.map((w: ThemeDayWord) => (typeof w?.word === 'string' ? w.word : String(w as unknown)));
                }
                let foundWords: string[] = [];
                if (Array.isArray(allThemeWordsDetailed)) {
                  foundWords = allThemeWordsDetailed.filter((w: ThemeDayWord) => !!w?.found).map((w: ThemeDayWord) => w.word);
                } else if (Array.isArray(themeDetails?.themeWordsFound)) {
                  foundWords = themeDetails.themeWordsFound.map((w: string | { word: string }) => (typeof w === 'string' ? w : w.word));
                } else if (Array.isArray(themeDetails?.progress?.foundWords)) {
                  foundWords = themeDetails.progress!.foundWords || [];
                } else if (Array.isArray(statsObj?.wordsFound)) {
                  foundWords = (statsObj.wordsFound || []).map((w: string | { word: string }) => (typeof w === 'string' ? w : w.word));
                }
                const foundSet = new Set(foundWords.map(w => String(w).toUpperCase()));
                const normalizedAll = allThemeWords.map(w => String(w).toUpperCase());
                const displayFoundCount = normalizedAll.filter(w => foundSet.has(w)).length;
                
                console.log('🎯 Modal debug - selectedThemeDay:', selectedThemeDay);
                console.log('🎯 Modal debug - themeDetails:', themeDetails);
                console.log('🎯 Modal debug - allThemeWords:', allThemeWords);
                console.log('🎯 Modal debug - foundWords:', foundWords);
                console.log('🎯 Modal debug - allThemeWords.length:', allThemeWords.length);
                console.log('🎯 Modal debug - foundWords.length:', foundWords.length);
                console.log('🎯 Modal debug - About to render theme words grid with', allThemeWords.length, 'words');
                console.log('🎯 Modal debug - First few theme words:', allThemeWords.slice(0, 5));

                
                return (
                  <div className="space-y-4">
                    {/* Progress Counter */}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{displayFoundCount}/{normalizedAll.length}</div>
                      <div className="text-sm text-gray-600">words found on {selectedThemeDay}</div>
                    </div>

                    {/* Theme Words Grid */}
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {normalizedAll.map((word: string, index: number) => {
                        const isFound = foundSet.has(word.toUpperCase());
                        return (
                          <div
                            key={index}
                            className={`
                              rounded-xl p-3 text-center transition-all duration-200 border-2
                              ${isFound 
                                ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300 shadow-md' 
                                : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:shadow-sm'
                              }
                            `}
                          >
                            <span className={`
                              font-semibold text-sm uppercase
                              ${isFound ? 'text-green-800' : 'text-gray-600'}
                            `}>
                              {word}
                            </span>
                            {isFound && (
                              <div className="mt-1">
                                <svg className="w-4 h-4 text-green-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        );
      })()}
      
      {/* Currency History Modal */}
      {currencyModal.isOpen && currencyModal.type && (
        <CurrencyHistoryModal
          isOpen={currencyModal.isOpen}
          onClose={() => setCurrencyModal({ isOpen: false, type: null })}
          currencyType={currencyModal.type}
          transactions={currencyHistory?.transactions.filter(t => t.type === currencyModal.type) || []}
          summary={
            currencyModal.type === 'flectcoins'
              ? {
                  earned: currencyHistory?.summary.flectcoins.earned || 0,
                  spent: currencyHistory?.summary.flectcoins.spent || 0,
                  net: currencyHistory?.summary.flectcoins.net || 0,
                }
              : {
                  earned: currencyHistory?.summary.gems.earned || 0,
                  spent: currencyHistory?.summary.gems.spent || 0,
                  net: currencyHistory?.summary.gems.net || 0,
                }
          }
          isLoading={isLoadingCurrencyHistory}
        />
      )}

      {/* Longest Word Modal (All Time or Today) */}
      {longWordModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto my-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{longWordModal.title || 'Longest Word'}</h3>
              <button
                onClick={() => setLongWordModal({ isOpen: false, word: '', date: null, title: '', history: [] })}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Longest Word</p>
                <p className="text-2xl font-bold text-blue-950">{longWordModal.word}</p>
              </div>
              {longWordModal.date && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Found Date & Time</p>
                  <p className="text-lg text-gray-900">
                    {new Date(longWordModal.date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    })}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    UTC: {new Date(longWordModal.date).toISOString()}
                  </p>
                </div>
              )}
              {!longWordModal.date && (
                <div>
                  <p className="text-sm text-gray-500">Date information not available</p>
                </div>
              )}
              
              {/* Previous Records History */}
              {longWordModal.history && longWordModal.history.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Previous Records</p>
                  <div className="space-y-3">
                    {longWordModal.history.map((record, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-lg font-bold text-gray-900">{record.word}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {record.word.length} {record.word.length === 1 ? 'letter' : 'letters'}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Found:</span>{' '}
                            {new Date(record.date).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            })}
                          </p>
                          {record.replacedBy && record.replacedDate && (
                            <p className="text-gray-500">
                              <span className="font-medium">Replaced by:</span>{' '}
                              <span className="font-semibold text-blue-950">{record.replacedBy}</span>{' '}
                              on{' '}
                              {new Date(record.replacedDate).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Score Modal */}
      {topScoreModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto my-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{topScoreModal.title || 'Top Score'}</h3>
              <button
                onClick={() => setTopScoreModal({ isOpen: false, score: 0, date: null, title: '', history: [] })}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Top Score</p>
                <p className="text-2xl font-bold text-blue-950">{topScoreModal.score.toLocaleString()}</p>
              </div>
              {topScoreModal.date && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Achieved Date & Time</p>
                  <p className="text-lg text-gray-900">
                    {new Date(topScoreModal.date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    })}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    UTC: {new Date(topScoreModal.date).toISOString()}
                  </p>
                </div>
              )}
              {!topScoreModal.date && (
                <div>
                  <p className="text-sm text-gray-500">Date information not available</p>
                </div>
              )}
              
              {/* Next Highest Scores */}
              {topScoreModal.history && topScoreModal.history.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Next Highest Scores</p>
                  <div className="space-y-3">
                    {topScoreModal.history.map((record, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-lg font-bold text-gray-900">{record.score.toLocaleString()}</p>
                            <p className="text-sm text-gray-600 mt-1">points</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Achieved:</span>{' '}
                            {new Date(record.date).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            })}
                          </p>
                          {record.replacedBy != null && record.replacedDate && (
                            <p className="text-gray-500">
                              <span className="font-medium">Replaced by:</span>{' '}
                              <span className="font-semibold text-blue-950">{record.replacedBy.toLocaleString()}</span>{' '}
                              on{' '}
                              {new Date(record.replacedDate).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Placements Modal */}
      {leaderboardModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto my-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Leaderboard Placements</h3>
              <button
                onClick={() => setLeaderboardModal({ isOpen: false, filter: 'all' })}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 mb-6 flex-wrap">
              <button
                onClick={() => setLeaderboardModal({ ...leaderboardModal, filter: 'all' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  leaderboardModal.filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Placements
              </button>
              <button
                onClick={() => setLeaderboardModal({ ...leaderboardModal, filter: 'gold' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  leaderboardModal.filter === 'gold'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                🥇 Gold ({profile.firstPlaceFinishes})
              </button>
              <button
                onClick={() => setLeaderboardModal({ ...leaderboardModal, filter: 'silver' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  leaderboardModal.filter === 'silver'
                    ? 'bg-gray-400 text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                🥈 Silver ({profile.secondPlaceFinishes})
              </button>
              <button
                onClick={() => setLeaderboardModal({ ...leaderboardModal, filter: 'bronze' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  leaderboardModal.filter === 'bronze'
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                }`}
              >
                🥉 Bronze ({profile.thirdPlaceFinishes})
              </button>
            </div>

            {/* Placements List */}
            <div className="space-y-3">
              {(() => {
                const placements: Array<{
                  placement: 1 | 2 | 3;
                  date: string;
                  period: 'daily' | 'weekly' | 'monthly';
                  periodLabel?: string;
                  score?: number;
                }> = []; // leaderboardPlacementHistory not available on UserProfile
                
                // Filter placements based on current filter
                let filteredPlacements = placements;
                if (leaderboardModal.filter === 'gold') {
                  filteredPlacements = placements.filter((p: { placement: 1 | 2 | 3 }) => p.placement === 1);
                } else if (leaderboardModal.filter === 'silver') {
                  filteredPlacements = placements.filter((p: { placement: 1 | 2 | 3 }) => p.placement === 2);
                } else if (leaderboardModal.filter === 'bronze') {
                  filteredPlacements = placements.filter((p: { placement: 1 | 2 | 3 }) => p.placement === 3);
                }
                
                // Sort by date (most recent first)
                filteredPlacements = [...filteredPlacements].sort((a, b) => {
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

                if (filteredPlacements.length === 0) {
                  return (
                    <div className="text-center py-12">
                      {placements.length === 0 ? (
                        <>
                          <div className="text-6xl mb-4">📊</div>
                          <p className="text-lg font-semibold text-gray-700 mb-2">Detailed History Not Available</p>
                          <p className="text-sm text-gray-500 mb-4">
                            Placement history tracking requires backend support. Currently, only total counts are available.
                          </p>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                            <p className="text-sm text-blue-900 font-medium mb-2">Current Totals:</p>
                            <div className="space-y-1 text-sm text-blue-700">
                              <p>🥇 Gold (1st Place): {profile.firstPlaceFinishes}</p>
                              <p>🥈 Silver (2nd Place): {profile.secondPlaceFinishes}</p>
                              <p>🥉 Bronze (3rd Place): {profile.thirdPlaceFinishes}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-4">
                            {leaderboardModal.filter === 'gold' ? '🥇' : leaderboardModal.filter === 'silver' ? '🥈' : leaderboardModal.filter === 'bronze' ? '🥉' : '📊'}
                          </div>
                          <p className="text-lg font-semibold text-gray-700">No placements found for this filter</p>
                        </>
                      )}
                    </div>
                  );
                }

                return filteredPlacements.map((placement: {
                  placement: 1 | 2 | 3;
                  date: string;
                  period: 'daily' | 'weekly' | 'monthly';
                  periodLabel?: string;
                  score?: number;
                }, index: number) => {
                  const placementEmoji = placement.placement === 1 ? '🥇' : placement.placement === 2 ? '🥈' : '🥉';
                  const placementLabel = placement.placement === 1 ? 'Gold' : placement.placement === 2 ? 'Silver' : 'Bronze';
                  const textColorClass = placement.placement === 1 ? 'text-amber-700' : placement.placement === 2 ? 'text-gray-700' : 'text-orange-700';
                  const emojiColorClass = placement.placement === 1 ? 'text-amber-500' : placement.placement === 2 ? 'text-gray-400' : 'text-orange-500';
                  
                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`text-3xl ${emojiColorClass}`}>
                            {placementEmoji}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-bold text-lg ${textColorClass}`}>
                                {placementLabel} Place
                              </span>
                              {placement.periodLabel && (
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                  {placement.periodLabel}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {new Date(placement.date).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                              })}
                            </p>
                            {placement.score != null && (
                              <p className="text-xs text-gray-500 mt-1">
                                Score: {placement.score.toLocaleString()}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              UTC: {new Date(placement.date).toISOString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Battle History Modal */}
      {battleModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4 flex flex-col max-h-[90vh]">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Battle History</h3>
              <button
                onClick={() => setBattleModal({ isOpen: false, filter: 'all' })}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Fixed Filter Buttons */}
            <div className="flex gap-2 p-6 pt-4 pb-4 flex-wrap flex-shrink-0 border-b border-gray-100">
              <button
                onClick={() => setBattleModal({ ...battleModal, filter: 'all' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  battleModal.filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Battles
              </button>
              <button
                onClick={() => setBattleModal({ ...battleModal, filter: 'wins' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  battleModal.filter === 'wins'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                🏆 Wins ({profile.battleWins})
              </button>
              <button
                onClick={() => setBattleModal({ ...battleModal, filter: 'losses' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  battleModal.filter === 'losses'
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                ❌ Losses ({profile.battleLosses})
              </button>
            </div>

            {/* Scrollable Battle History List */}
            <div className="p-6 pt-4 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-3">
                {(() => {
                const battles: Array<{
                  result: 'win' | 'loss';
                  opponentId: string;
                  opponentUsername: string;
                  myScore: number;
                  opponentScore: number;
                  date: string;
                  battleId: string;
                }> = []; // battleHistory not available on UserProfile
                
                // Filter battles based on current filter
                let filteredBattles = battles;
                if (battleModal.filter === 'wins') {
                  filteredBattles = battles.filter((b: { result: 'win' | 'loss' }) => b.result === 'win');
                } else if (battleModal.filter === 'losses') {
                  filteredBattles = battles.filter((b: { result: 'win' | 'loss' }) => b.result === 'loss');
                }
                
                // Sort by date (most recent first)
                filteredBattles = [...filteredBattles].sort((a, b) => {
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

                if (filteredBattles.length === 0) {
                  return (
                    <div className="text-center py-12">
                      {battles.length === 0 ? (
                        <>
                          <div className="text-6xl mb-4">⚔️</div>
                          <p className="text-lg font-semibold text-gray-700 mb-2">Battle History Not Available</p>
                          <p className="text-sm text-gray-500 mb-4">
                            Battle history tracking requires backend support. Currently, only total counts are available.
                          </p>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                            <p className="text-sm text-blue-900 font-medium mb-2">Current Totals:</p>
                            <div className="space-y-1 text-sm text-blue-700">
                              <p>🏆 Wins: {profile.battleWins}</p>
                              <p>❌ Losses: {profile.battleLosses}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-4">
                            {battleModal.filter === 'wins' ? '🏆' : battleModal.filter === 'losses' ? '❌' : '⚔️'}
                          </div>
                          <p className="text-lg font-semibold text-gray-700">No battles found for this filter</p>
                        </>
                      )}
                    </div>
                  );
                }

                return filteredBattles.map((battle: {
                  result: 'win' | 'loss';
                  opponentId: string;
                  opponentUsername: string;
                  myScore: number;
                  opponentScore: number;
                  date: string;
                  battleId: string;
                }, index: number) => {
                  const isWin = battle.result === 'win';
                  const resultEmoji = isWin ? '🏆' : '❌';
                  const resultLabel = isWin ? 'Win' : 'Loss';
                  const textColorClass = isWin ? 'text-emerald-700' : 'text-rose-700';
                  const emojiColorClass = isWin ? 'text-emerald-500' : 'text-rose-500';
                  
                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`text-3xl ${emojiColorClass}`}>
                            {resultEmoji}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-bold text-lg ${textColorClass}`}>
                                {resultLabel}
                              </span>
                              <span className="text-sm text-gray-600">vs</span>
                              <span className="font-semibold text-gray-900">{battle.opponentUsername}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="font-medium">Your Score: <span className={`font-bold ${textColorClass}`}>{battle.myScore.toLocaleString()}</span></span>
                              <span>•</span>
                              <span>Opponent: <span className="font-medium">{battle.opponentScore.toLocaleString()}</span></span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(battle.date).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                              })}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              UTC: {new Date(battle.date).toISOString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// UI Subcomponents
function MetricCard({ 
  title, 
  value, 
  accent, 
  onClick 
}: { 
  title: string; 
  value: string | number; 
  accent: string;
  onClick?: () => void;
}) {
  // Get icon based on title
  const getIcon = () => {
    if (title.toLowerCase().includes('flectcoin')) {
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else if (title.toLowerCase().includes('gem')) {
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    }
    return null;
  };

  // Extract gradient colors for icon background
  const getIconGradient = () => {
    if (title.toLowerCase().includes('flectcoin')) {
      return 'from-amber-500 to-yellow-600';
    } else if (title.toLowerCase().includes('gem')) {
      return 'from-pink-500 to-rose-600';
    }
    return 'from-blue-500 to-indigo-600';
  };

  return (
    <div 
      className={`relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100 p-4 ${
        onClick ? 'cursor-pointer hover:shadow-xl transition-all' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {/* Gradient background accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${accent} opacity-10 rounded-bl-full`} />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 bg-gradient-to-r ${getIconGradient()} rounded-full flex items-center justify-center`}>
            {getIcon()}
          </div>
          <h3 className="font-bold text-base text-blue-950">{title}</h3>
        </div>
        
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 bg-gradient-to-br ${getIconGradient()} rounded-lg flex items-center justify-center shadow-md`}>
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-600">Balance</p>
            <p className="text-2xl font-extrabold text-gray-900">{value}</p>
            {onClick && (
              <p className="text-xs text-gray-500 mt-0.5">Click to view history</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PremiumStat({ 
  title, 
  value, 
  subtitle, 
  icon,
  gradient,
  onClick, 
  clickable 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const Component = clickable && onClick ? 'button' : 'div';
  return (
    <Component
      onClick={clickable && onClick ? onClick : undefined}
      className={`relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100 p-6 transition-all duration-300 ${
        clickable && onClick 
          ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-gray-200' 
          : ''
      }`}
      role={clickable && onClick ? 'button' : undefined}
      tabIndex={clickable && onClick ? 0 : undefined}
      onKeyDown={clickable && onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {/* Gradient background accent */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-full`} />
      
      <div className="relative z-10">
        {/* Icon with gradient background */}
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} mb-4 shadow-md`}>
          <div className="text-white">
            {icon}
          </div>
        </div>
        
        {/* Title */}
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        
        {/* Value */}
        <p className={`text-3xl font-extrabold text-gray-900 mb-1 ${clickable && onClick ? 'group-hover:text-gray-950' : ''}`}>
          {value}
        </p>
        
        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
        )}
        
        {/* Click hint for interactive stats */}
        {clickable && onClick && (
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>View history</span>
          </div>
        )}
      </div>
      
      {/* Decorative corner accent */}
      <div className={`absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr ${gradient} opacity-5 rounded-tr-full`} />
    </Component>
  );
}

function MiniStat({ title, value, subtitle, onClick, clickable }: { title: string; value: string | number; subtitle?: string; onClick?: () => void; clickable?: boolean }) {
  const Component = clickable && onClick ? 'button' : 'div';
  return (
    <Component
      onClick={clickable && onClick ? onClick : undefined}
      className={`rounded-lg border border-blue-100 p-4 ${clickable && onClick ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors' : ''}`}
    >
      <p className="text-sm text-blue-700">{title}</p>
      <p className={`mt-1 text-xl font-bold text-blue-950 ${clickable && onClick ? 'underline decoration-dotted' : ''}`}>{value}</p>
      {subtitle && <p className="text-xs text-blue-600">{subtitle}</p>}
    </Component>
  );
}

function Bar({ title, value, color, total, onClick }: { title: string; value: number; color: string; total: number; onClick?: () => void }) {
  const height = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 6;
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      className={`flex flex-col items-center justify-end h-full min-w-[48px] ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className={`w-8 ${color} rounded-t transition-all ${onClick ? 'hover:shadow-md' : ''}`} style={{ height: `${height}%` }} />
      <div className="mt-2 text-xs text-blue-900 font-semibold">{title}</div>
      <div className="text-[11px] text-blue-700">{value}</div>
    </Component>
  );
}

function LineChart({ data, height = 240, color = '#4f46e5', wordsEmptyText = 'No new words', wordsPreFormatted = false }: { data: { date: Date; value: number; words?: string[] }[]; height?: number; color?: string; wordsEmptyText?: string; wordsPreFormatted?: boolean }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1024);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-white rounded-lg p-4 border border-gray-200" ref={containerRef}>
        <div className="flex items-center justify-center h-48 text-gray-500">
          <p>{wordsEmptyText}</p>
        </div>
      </div>
    );
  }

  const isMobile = containerWidth < 768;
  const leftMargin = isMobile ? 45 : 60;
  const rightMargin = isMobile ? 15 : 30;
  const topMargin = 30; // Increased to ensure Y-axis labels and tooltips fit
  const bottomAxisMargin = 25; // Space at bottom of SVG for Y-axis labels and baseline (0 line)
  const bottomMargin = isMobile ? 50 : 40; // Space for date labels (HTML labels below SVG)
  
  // Calculate chart area width - ensure minimum width to prevent squishing
  const minChartAreaWidth = containerWidth - leftMargin - rightMargin - (isMobile ? 20 : 40);
  const spacingPerPoint = isMobile ? 20 : 24;
  const calculatedChartAreaWidth = data.length * spacingPerPoint;
  // Use the larger of calculated width or minimum width to prevent collapsing
  const chartAreaWidth = Math.max(minChartAreaWidth, calculatedChartAreaWidth);
  const svgWidth = chartAreaWidth + leftMargin + rightMargin;
  // Chart height accounts for top margin and bottom axis margin (for Y-axis labels)
  const chartHeight = height - topMargin - bottomAxisMargin - bottomMargin;
  
  const max = Math.max(1, ...data.map(d => d.value));

  // Calculate points for the line - distribute evenly across chart area width
  const pointSpacing = data.length > 1 ? chartAreaWidth / (data.length - 1) : 0;
  // Chart bottom is within SVG, accounting for bottom axis margin
  const chartBottom = topMargin + chartHeight;
  const points = data.map((d, i) => {
    const x = leftMargin + (i * pointSpacing);
    // Ensure 0 is at the bottom of the chart area (not cut off)
    const y = chartBottom - ((d.value / max) * chartHeight);
    return { x, y, data: d, index: i };
  });

  // Create path strings for the line and area
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`;

  // Date label interval - show more labels for shorter ranges
  const dateLabelInterval = data.length <= 7 
    ? 1  // Show all labels if 7 days or fewer
    : data.length <= 30
      ? isMobile ? Math.max(1, Math.floor(data.length / 6)) : Math.max(1, Math.floor(data.length / 10))  // 30 days: ~6 labels mobile, ~10 desktop
      : isMobile ? Math.max(1, Math.floor(data.length / 8)) : Math.max(1, Math.floor(data.length / 12)); // Longer: ~8 labels mobile, ~12 desktop

  const formatWords = (wordList: string[]) => {
    if (wordList.length === 0) {
      if (max > 0) {
        return [`${max} words found`];
      }
      return [wordsEmptyText];
    }
    if (wordsPreFormatted) return wordList;
    if (wordList.length <= 3) return [wordList.join(', ')];
    const words = wordList.slice(0, 6);
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += 3) {
      const lineWords = words.slice(i, i + 3);
      lines.push(lineWords.join(', '));
    }
    if (wordList.length > 6) {
      lines[lines.length - 1] += ` and ${wordList.length - 6} more`;
    }
    return lines;
  };

  return (
    <div className="w-full bg-white rounded-lg p-4 border border-gray-200" ref={containerRef}>
      <div className="w-full overflow-x-auto overflow-y-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative" style={{ minWidth: `${svgWidth}px`, height: `${height}px` }}>
          {/* SVG Chart */}
          <svg 
            width={svgWidth} 
            height={height - bottomMargin}
            className="block"
            style={{ minWidth: `${svgWidth}px` }}
            viewBox={`0 0 ${svgWidth} ${height - bottomMargin}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`areaGradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
              </linearGradient>
              <linearGradient id={`lineGradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity="0.8"/>
                <stop offset="100%" stopColor={color} stopOpacity="1"/>
              </linearGradient>
            </defs>
            
            {/* Area under the curve */}
            <path 
              d={areaPath} 
              fill={`url(#areaGradient-${color.replace('#', '')})`} 
              stroke="none"
            />
            
            {/* Main line */}
            <path 
              d={linePath} 
              fill="none" 
              stroke={`url(#lineGradient-${color.replace('#', '')})`} 
              strokeWidth="3" 
              strokeLinejoin="round" 
              strokeLinecap="round"
              className="transition-all duration-200"
            />
            
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const value = Math.round(max * ratio);
              // Calculate Y position ensuring 0 is at the bottom and visible
              // SVG height is (height - bottomMargin), chartBottom is at (height - bottomAxisMargin - bottomMargin)
              // Position 0 label at the bottom of the SVG with some padding
              const svgHeight = height - bottomMargin;
              const y = ratio === 0 
                ? svgHeight - 5  // Position 0 label near bottom of SVG, fully visible
                : chartBottom - (ratio * chartHeight) + 4;
              return (
                <text
                  key={ratio}
                  x={leftMargin - 10}
                  y={y}
                  textAnchor="end"
                  className="fill-gray-700 font-semibold"
                  fontSize={isMobile ? "10" : "11"}
                >
                  {value}
                </text>
              );
            })}
            
            {/* Interactive data points */}
            {points.map((point, i) => {
              const isHovered = hoveredPoint === i;
              const isSelected = selectedPoint === i;
              return (
                <g key={i}>
                  {/* Invisible larger hit area */}
                  <circle 
                    cx={point.x} 
                    cy={point.y} 
                    r="12" 
                    fill="transparent" 
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => setSelectedPoint(prev => prev === i ? null : i)}
                    className="cursor-pointer"
                  />
                  {/* Visible point */}
                  <circle 
                    cx={point.x} 
                    cy={point.y} 
                    r={isHovered || isSelected ? "6" : "4"} 
                    fill={isHovered || isSelected ? "#ffffff" : color}
                    stroke={isHovered || isSelected ? color : "#ffffff"}
                    strokeWidth={isHovered || isSelected ? "3" : "2"}
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML Tooltip (positioned absolutely) */}
          {(hoveredPoint !== null || selectedPoint !== null) && (() => {
            const pointIndex = selectedPoint !== null ? selectedPoint : hoveredPoint;
            if (pointIndex === null) return null;
            const point = points[pointIndex];
            
            // Calculate tooltip position - ensure it stays within bounds
            const tooltipHeight = 100; // Approximate tooltip height
            const tooltipAboveY = point.y - tooltipHeight - 10;
            const tooltipBelowY = point.y + 20;
            const minTop = 5; // Minimum distance from top
            
            // Position tooltip above point if there's room, otherwise below
            const tooltipY = tooltipAboveY >= minTop ? tooltipAboveY : tooltipBelowY;
            
            return (
              <div
                className="absolute z-20 bg-gray-900 text-white rounded-lg p-2 shadow-xl pointer-events-none"
                style={{
                  left: `${point.x}px`,
                  top: `${tooltipY}px`,
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  maxWidth: '200px',
                  whiteSpace: 'nowrap',
                }}
              >
                <div className="text-blue-300 font-semibold mb-1">
                  {point.data.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="text-white font-bold mb-1">
                  {point.data.value} {wordsPreFormatted ? 'words' : 'words'}
                </div>
                {point.data.words && point.data.words.length > 0 && (
                  <div className="text-gray-300 text-xs mt-1 border-t border-gray-700 pt-1">
                    {formatWords(point.data.words).map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* HTML Date Labels - positioned below SVG */}
          <div 
            className="absolute"
            style={{ 
              top: `${height - bottomMargin}px`, 
              height: `${bottomMargin}px`,
              left: `${leftMargin}px`,
              width: `${chartAreaWidth}px`,
            }}
          >
            {data.map((d, i) => {
              const showLabel = i % dateLabelInterval === 0 || i === data.length - 1;
              if (!showLabel) return null;
              
              // Position label at the same x position as the data point (relative to container)
              const labelX = i * pointSpacing;
              
              return (
                <div
                  key={i}
                  className="absolute text-xs font-semibold text-gray-700"
                  style={{
                    left: `${labelX}px`,
                    transform: 'translateX(-50%)',
                    fontSize: isMobile ? '10px' : '11px',
                    whiteSpace: 'nowrap',
                    top: '5px',
                  }}
                >
                  {isMobile
                    ? d.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
                    : d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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