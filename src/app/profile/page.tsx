"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService, UserProfile } from "@/services/api";
import MissionResetCountdown from "@/components/MissionResetCountdown";

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
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "1y" | "all" | "custom">("30d");
  
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Record<string, boolean>>({});
  const [timeAnalytics, setTimeAnalytics] = useState<Record<string, unknown> | null>(null);
  const [themeAnalytics, setThemeAnalytics] = useState<Record<string, unknown> | null>(null);
  const [selectedThemeDay, setSelectedThemeDay] = useState<string | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  // const [refreshing, setRefreshing] = useState(false); // Removed: no manual refresh in production
  
  // Time period filter state
  const [timePeriodFilter, setTimePeriodFilter] = useState<string>('ALL');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  
  // Historical theme analytics state
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string>('');
  const [historicalThemeData, setHistoricalThemeData] = useState<{
    theme?: {
      name: string;
      words: string[];
    };
    stats?: {
      totalThemeWordsFound: number;
      completionRate: number;
      isCompleted: boolean;
    };
    allThemeWords?: Array<{
      word: string;
      found: boolean;
    }>;
  } | null>(null);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);

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
      if (range === '7d') { d.setDate(d.getDate() - 6); return d; }
      if (range === '30d') { d.setDate(d.getDate() - 29); return d; } // 30 days including today
      if (range === '90d') { d.setDate(d.getDate() - 89); return d; } // 90 days including today
      if (range === '1y') { d.setFullYear(d.getFullYear() - 1); return d; }
      if (range === 'all') { 
        // Find the earliest date from user's words
        const earliestDate = entries.length > 0 
          ? new Date(Math.min(...entries.map(e => e.date.getTime())))
          : new Date(now);
        return earliestDate;
      }
      if (range === 'custom' && customDateRange.start && customDateRange.end) {
        return new Date(customDateRange.start + 'T00:00:00');
      }
      return new Date(0);
    })();
    
    // Determine the end date based on range
    const endDate = (() => {
      if (range === 'custom' && customDateRange.end) {
        return new Date(customDateRange.end + 'T23:59:59');
      }
      return now;
    })();
    

    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
        if (!dayCounts.has(k)) dayCounts.set(k, { date: new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()), count: 0, avgLenSum: 0, lenCount: 0, words: [] });
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
  }, [range, customDateRange.start, customDateRange.end]); // Add dependencies for the aggregated function

  // Backend history integration
  const [historyDays, setHistoryDays] = useState<{ date: Date; value: number; avgLen?: number }[] | null>(null);
  const [sessionWordsDays, setSessionWordsDays] = useState<{ date: Date; value: number; avgLen?: number }[] | null>(null);
  
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
    const currentStreakDays = detailedStats?.currentStreakDays ?? profile?.currentStreakDays ?? (sortedDays.length ? current : undefined);
    const longestStreakDays = detailedStats?.longestStreakDays ?? profile?.longestStreakDays ?? (sortedDays.length ? longest : undefined);
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
    const load = async () => {
      try {
        if (!apiService.isAuthenticated()) return;

        // Map UI range to backend range param
        const mapRange = (r: typeof range): string | undefined => {
          if (r === '7d') return '7d';
          if (r === '30d') return '30d';
          if (r === '90d') return '90d';
          if (r === '1y') return '1y';
          if (r === 'all') return 'all';
          if (r === 'custom') return 'all';
          return undefined;
        };

        const res = await apiService.getUserHistory({ range: mapRange(range) });
        const daysFromApi = Array.isArray(res.days) ? res.days.map(d => ({
          date: new Date(d.date),
          value: typeof d.value === 'number' ? d.value : 0,
          avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined
        })) : [];

        if (range === 'custom' && customDateRange.start && customDateRange.end) {
          const startDate = new Date(customDateRange.start + 'T00:00:00');
          const endDate = new Date(customDateRange.end + 'T23:59:59');
          const filtered = daysFromApi.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= startDate && dataDate <= endDate;
          });
          setHistoryDays(filtered.length ? filtered : null);
        } else {
          setHistoryDays(daysFromApi.length ? daysFromApi : null);
        }
      } catch (error) {
        console.warn('Falling back to client aggregation for history:', error);
        setHistoryDays(null);
      }
    };
    load();
  }, [range, customDateRange.start, customDateRange.end]);

  // Load session words data
  useEffect(() => {
    const loadSessionWords = async () => {
      try {
        console.log('🟢 Loading session words data...');
        console.log('🟢 Force Vercel rebuild - session words API call - v2');
        
        // Check authentication instead of waiting for profile
        if (!apiService.isAuthenticated()) {
          console.log('❌ Not authenticated for session words');
          setSessionWordsDays(null);
          return;
        }

        console.log('🎯 Starting session words fetch (independent of profile)');
        console.log('🔐 Is authenticated:', apiService.isAuthenticated());
        console.log('🔐 Token expired:', apiService.isTokenExpired());
        
        // Map UI range to backend range param
        const mapRange = (r: typeof range): string | undefined => {
          if (r === '7d') return '7d';
          if (r === '30d') return '30d';
          if (r === '90d') return '90d';
          if (r === '1y') return '1y';
          if (r === 'all') return 'all';
          if (r === 'custom') return 'all'; // Custom range fetches all and filters client-side
          return undefined;
        };

        const mappedRange = mapRange(range);
        console.log('🟢 Mapped range:', mappedRange);
        
        const res = await apiService.getUserSessionWords({ range: mappedRange });
        console.log('🟢 Session words API response:', res);
        console.log('🟢 Session words API response type:', typeof res);
        console.log('🟢 Session words API response keys:', Object.keys(res || {}));
        console.log('🟢 Session words API response.days:', res.days);
        console.log('🟢 Session words API response.days type:', typeof res.days);
        console.log('🟢 Session words API response.days length:', Array.isArray(res.days) ? res.days.length : 'not array');
        
        const daysFromApi = Array.isArray(res.days) ? res.days.map(d => ({
          date: new Date(d.date), // Parse date string directly
          value: typeof d.value === 'number' ? d.value : 0,
          avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined
        })) : [];
        
        console.log('🟢 Processed session words days:', daysFromApi);
        console.log('🟢 Processed session words days length:', daysFromApi.length);
        console.log('🟢 Processed session words days sample:', daysFromApi.slice(0, 3));
        console.log('🟢 Last 3 days from API:', daysFromApi.slice(-3));
        console.log('🟢 Today check - last day date:', daysFromApi[daysFromApi.length - 1]?.date);
        console.log('🟢 Today check - last day value:', daysFromApi[daysFromApi.length - 1]?.value);
        
        // For custom range, filter client-side after getting all data
        if (range === "custom" && customDateRange.start && customDateRange.end) {
          const startDate = new Date(customDateRange.start + 'T00:00:00');
          const endDate = new Date(customDateRange.end + 'T23:59:59');
          
          const filteredData = daysFromApi.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= startDate && dataDate <= endDate;
          });
          
          // Data is already processed with Date objects
          const processedFilteredData = filteredData;
          
          console.log('🟢 Filtered session words data:', processedFilteredData);
          console.log('🟢 Setting filtered session words days, length:', processedFilteredData.length);
          setSessionWordsDays(processedFilteredData);
        } else {
        console.log('🟢 Setting session words days:', daysFromApi);
        console.log('🟢 Setting session words days, length:', daysFromApi.length);
        console.log('🟢 Setting session words days, first few:', daysFromApi.slice(0, 3));
        setSessionWordsDays(daysFromApi);
        console.log('🟢 Session words days state set, checking in next tick...');
        setTimeout(() => {
          console.log('🟢 Session words days state after set:', daysFromApi);
        }, 100);
        }
      } catch (error) {
        console.error('🟢 Session words error:', error);
        console.warn('Falling back to client aggregation for session words:', error);
        setSessionWordsDays(null);
      }
    };
    loadSessionWords();
  }, [range, customDateRange.start, customDateRange.end]);


  const fetchProfile = useCallback(async () => {
    try {
      // Data refreshes on mount/route
      
        if (!apiService.isAuthenticated()) {
          router.push("/signin");
          setLoading(false);
          return;
        }

        const userProfile = await apiService.getUserProfile();
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
    } catch (error) {
        console.error("Profile fetch error:", error);
        setError(error instanceof Error ? error.message : "Failed to load profile");
        if (error instanceof Error && error.message.includes("Authentication failed")) {
          router.push("/signin");
        }
        setLoading(false);
      }
    }, [router]);

  useEffect(() => {
    fetchProfile();

    const handleVisibilityChange = () => {
      if (!document.hidden && apiService.isAuthenticated()) {
        fetchProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router, fetchProfile]);

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
        
        const response = await apiService.getTimeAnalytics();
        console.log('✅ Backend time analytics response:', response);
        
        if (response && (response as Record<string, unknown>).analytics) {
          const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
          console.log('📊 Time analytics data from backend:', analytics);
          console.log('📊 Time periods structure:', analytics.timePeriods);
          console.log('📊 Time periods keys:', Object.keys(analytics.timePeriods || {}));
          if (analytics.timePeriods) {
            Object.entries(analytics.timePeriods).forEach(([period, data]) => {
              console.log(`📊 ${period}:`, data);
            });
          }
          setTimeAnalytics(analytics);
        } else {
          console.warn('⚠️ No analytics data in backend response');
          console.log('⚠️ Full response structure:', response);
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

        // Augment with current week's 7 days so all cards are clickable
        try {
          const today = new Date();
          const dayIdx = today.getUTCDay(); // 0=Sun..6=Sat (UTC)
          const sunday = new Date(today);
          sunday.setUTCDate(today.getUTCDate() - dayIdx);
          const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

          type ThemeDayResponse = {
            success?: boolean;
            date?: string;
            theme?: { name: string; words: string[]; dailyGoal: number; totalWords?: number };
            stats?: { totalThemeWordsFound?: number; completionRate?: number; isCompleted?: boolean };
            allThemeWords?: { word: string; length: number; found: boolean }[];
            themeWordsFound?: { word: string; length: number; found: boolean }[];
            remainingThemeWords?: { word: string; length: number; found: boolean }[];
            timestamp?: string;
          };

          const weekFetches = Array.from({ length: 7 }).map(async (_, i) => {
            const dateObj = new Date(sunday);
            dateObj.setUTCDate(sunday.getUTCDate() + i);
            const dateStr = dateObj.toISOString().split('T')[0];
            const dayName = dayNames[i];
            try {
              const dayRes = await apiService.getThemeDayStatistics(dateStr) as ThemeDayResponse;
              console.log(`🎯 ${dayName} (${dateStr}) backend response:`, dayRes);
              
              // Store raw response under keys consumed by UI
              (analytics as Record<string, unknown>)[`${dayName}_response`] = dayRes as unknown as Record<string, unknown>;
              (analytics as Record<string, unknown>)[`${dayName}_themeDetails`] = dayRes as unknown as Record<string, unknown>;
              const words = Array.isArray(dayRes?.theme?.words) ? dayRes.theme!.words : [];
              (analytics as Record<string, unknown>)[`${dayName}_themeWords`] = words as unknown as Record<string, unknown>;
              // Store simple progress for card display
              const found = Array.isArray(dayRes?.allThemeWords)
                ? (dayRes!.allThemeWords!.filter(w => !!w.found).length)
                : (typeof dayRes?.stats?.totalThemeWordsFound === 'number' ? dayRes!.stats!.totalThemeWordsFound! : 0);
              const total = Array.isArray(words) && words.length ? words.length : 20;
              console.log(`🎯 ${dayName} progress calculation:`, { found, total, allThemeWords: dayRes?.allThemeWords, stats: dayRes?.stats });
              console.log(`🎯 ${dayName} allThemeWords details:`, dayRes?.allThemeWords?.map((w: { word: string; found: boolean }) => ({ word: w.word, found: w.found })));
              console.log(`🎯 ${dayName} stats details:`, dayRes?.stats);
              (analytics as Record<string, unknown>)[`${dayName}_progress`] = { found, total } as unknown as Record<string, unknown>;
              return { dayName, ok: true };
            } catch (e) {
              console.warn(`Theme day fetch failed for ${dayName} ${dateStr}:`, e);
              (analytics as Record<string, unknown>)[`${dayName}_response`] = null as unknown as Record<string, unknown>;
              (analytics as Record<string, unknown>)[`${dayName}_themeDetails`] = null as unknown as Record<string, unknown>;
              (analytics as Record<string, unknown>)[`${dayName}_themeWords`] = [] as unknown as Record<string, unknown>;
              (analytics as Record<string, unknown>)[`${dayName}_progress`] = { found: 0, total: 20 } as unknown as Record<string, unknown>;
              return { dayName, ok: false };
            }
          });
          await Promise.all(weekFetches);
        } catch (e) {
          console.warn('Week augmentation failed:', e);
        }

        // If current day has no theme data, try to show previous day's data
        const today = new Date();
        const todayDay = today.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
        const yesterday = new Date(today);
        yesterday.setUTCDate(today.getUTCDate() - 1);
        const yesterdayDay = yesterday.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
        
        // Check if current day has no theme data but previous day does
        const currentDayData = analytics[`${todayDay}_response`];
        const previousDayData = analytics[`${yesterdayDay}_response`];
        
        if (!currentDayData && previousDayData) {
          console.log(`🎯 Current day (${todayDay}) has no theme data, showing previous day (${yesterdayDay}) data`);
          // Copy previous day's data to current day for display
          analytics[`${todayDay}_response`] = previousDayData;
          analytics[`${todayDay}_themeDetails`] = previousDayData;
          analytics[`${todayDay}_themeWords`] = analytics[`${yesterdayDay}_themeWords`];
          analytics[`${todayDay}_progress`] = analytics[`${yesterdayDay}_progress`];
        }

        setThemeAnalytics(analytics);
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
    
    // === GAMEPLAY HELP & TIPS ===
    if (query.includes('how to play') || query.includes('how do i play') || query.includes('rules')) {
      response = `WordFlect is a fun word puzzle game! Here's how it works:

Your goal is to find as many words as possible from a 4x4 letter grid. Words must be at least 3 letters long, and you can use adjacent letters including diagonals. Each letter can only be used once per word, and no proper nouns or abbreviations are allowed.

Here are some helpful tips: look for common prefixes and suffixes, start with longer words for more points, use your timer wisely, and complete daily themes for bonus rewards!

Premium subscribers get exclusive themes, bonus gems, and priority support!`;
    }
    
    else if (query.includes('scoring') || query.includes('points') || query.includes('how to score')) {
      response = `Here's how scoring works in WordFlect:

The longer your words, the more points you get. Three-letter words give you 1 point, four-letter words give you 2 points, five-letter words give you 3 points, six-letter words give you 4 points, and seven or more letter words give you 5 or more points.

You can earn bonus multipliers too! Daily theme words give you double points, perfect games earn you bonus gems, and maintaining streaks gives you extra rewards.

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
• Monthly: $4.99/month
• Annual: $39.99/year (33% savings!)
• Lifetime: $99.99 (one-time payment)

🎯 **Value Proposition**:
• Save 2+ hours per month with unlimited games
• Earn 2x rewards worth $10+ monthly
• Exclusive content worth $15+ monthly
• Total value: $25+ monthly for just $4.99!

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
• Premium Subscription: $4.99/month

🔒 **Security**:
• All payments processed securely
• No payment data stored on our servers
• PCI DSS compliant
• 256-bit SSL encryption

💎 **Premium Value**:
• Monthly subscription costs less than a coffee
• Annual subscription saves you $20/year
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
    setAiModalOpen(true);
    // Auto-speak welcome message when modal opens
    const welcomeMessage = `Hi! I'm Lexi, your AI WordFlect assistant. I can help you with gameplay, stats, customization, and even navigation. You can ask me to take you to the dashboard, sign you out, or open the WordFlect app. Try saying "How do I play?", "Take me to dashboard", or "Open app". Click the voice icon to enable audio, or use the text input to chat with me!`;
    setAiResponse(welcomeMessage);
    
    // Auto-speak after a short delay to ensure modal is open
    // Force unmute for welcome message
    setTimeout(() => {
      speakResponse(welcomeMessage, true); // Force unmute for welcome
    }, 500);
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
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
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
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
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

  // Helper function to determine current time period
  const getCurrentTimePeriod = () => {
    const now = new Date();
    const hour = now.getUTCHours();
    
    if (hour >= 0 && hour <= 4) return 'late-night';
    if (hour >= 5 && hour <= 9) return 'early-morning';
    if (hour >= 10 && hour <= 12) return 'late-morning';
    if (hour >= 13 && hour <= 17) return 'afternoon';
    if (hour >= 18 && hour <= 23) return 'evening';
    return 'late-night'; // fallback
  };

  // Helper function to get time period data
  const getTimePeriodData = (period: string) => {
    console.log('getTimePeriodData called for period:', period);
    console.log('timeAnalytics:', timeAnalytics);
    console.log('timeAnalytics.timePeriods:', timeAnalytics?.timePeriods);
    
    if (!timeAnalytics || !timeAnalytics.timePeriods) {
      console.log('No time analytics data available');
      return null;
    }

    // Backend returns timePeriods as an object with period keys, not an array
    const periodData = (timeAnalytics.timePeriods as Record<string, unknown>)[period];
    console.log(`getTimePeriodData - periodData for ${period}:`, periodData);
    
    if (periodData) {
      const data = periodData as Record<string, unknown>;
      console.log(`getTimePeriodData - data fields for ${period}:`, Object.keys(data));
      console.log(`getTimePeriodData - wordCount for ${period}:`, data.wordCount);
      console.log(`getTimePeriodData - gamesPlayed for ${period}:`, data.gamesPlayed);
      
      const wordsFound = (data.wordCount as number) || 0;
      const gamesPlayed = (data.gamesPlayed as number) || 0;
      const avgPerGame = gamesPlayed > 0 ? Math.round(wordsFound / gamesPlayed) : 0;
      const performance = Math.min(100, Math.round((wordsFound / 100) * 100)); // Scale to 100 max
      
      let status = 'No data';
      if (performance >= 80) status = '🏆 Peak performance!';
      else if (performance >= 60) status = '📈 Good performance';
      else if (performance >= 40) status = '📊 Average performance';
      else if (performance > 0) status = '📉 Lower performance';
      else status = '😴 No activity';

      return {
        wordsFound,
        gamesPlayed,
        avgPerGame,
        performance,
        status
      };
    }

    return {
      wordsFound: 0,
      gamesPlayed: 0,
      avgPerGame: 0,
      performance: 0,
      status: 'No data'
    };
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

    // Check if we have theme words data from the theme day API (prioritize this over old analytics)
    const themeWords = (themeAnalytics[`${day}_themeWords`] as string[]) || [];
    if (themeWords.length > 0) {
      console.log(`🎯 Using NEW theme words data for ${day}`);
      console.log(`Found theme words for ${day}:`, themeWords);
      
      // Check user's profile for found words that match this theme AND were found on the specific day
      const userFoundWords = profile?.allFoundWords || [];
      
      // Calculate the date for the selected day using UTC to match mobile app
      const today = new Date();
      const dayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayIndex = dayNames.indexOf(day);
      
      // Calculate the date for the selected day (this week) using UTC
      const daysUntilSelectedDay = selectedDayIndex - dayOfWeek;
      const selectedDate = new Date(today);
      selectedDate.setUTCDate(today.getUTCDate() + daysUntilSelectedDay);
      const selectedDateString = selectedDate.toISOString().split('T')[0];
      
      console.log(`🎯 DEBUG: Today is ${today.toISOString().split('T')[0]} (UTC day ${dayOfWeek})`);
      console.log(`🎯 DEBUG: Selected day is ${day} (index ${selectedDayIndex})`);
      console.log(`🎯 DEBUG: Days until selected day: ${daysUntilSelectedDay}`);
      console.log(`🎯 DEBUG: Calculated selected date: ${selectedDateString}`);
      console.log(`Looking for words found on ${selectedDateString} (${day})`);
      
      // Filter words found on the specific day
      const wordsFoundOnSelectedDay = userFoundWords.filter(userWord => {
        if (typeof userWord === 'string') return false; // Skip old format without dates
        if (userWord.date) {
          const wordDate = new Date(userWord.date).toISOString().split('T')[0];
          return wordDate === selectedDateString;
        }
        return false;
      });
      
      console.log(`🎯 DEBUG: Total user found words: ${userFoundWords.length}`);
      console.log(`🎯 DEBUG: Sample user words with dates:`, userFoundWords.slice(0, 5).map(w => typeof w === 'string' ? w : `${w.word} (${w.date})`));
      console.log(`Words found on ${selectedDateString}:`, wordsFoundOnSelectedDay.map(w => typeof w === 'string' ? w : w.word));
      
      // Check which theme words were found on the specific day
      const foundThemeWords = themeWords.filter(themeWord => 
        wordsFoundOnSelectedDay.some(userWord => {
          const word = typeof userWord === 'string' ? userWord : userWord.word;
          return word && word.toUpperCase() === themeWord.toUpperCase();
        })
      );
      
      console.log(`Found ${foundThemeWords.length} theme words on ${day}:`, foundThemeWords);
      console.log(`🎯 DEBUG: themeWords:`, themeWords);
      console.log(`🎯 DEBUG: wordsFoundOnSelectedDay:`, wordsFoundOnSelectedDay);
      console.log(`🎯 DEBUG: foundThemeWords:`, foundThemeWords);
      
      return {
        wordsFound: foundThemeWords.length,
        totalWords: themeWords.length,
        completionPercent: themeWords.length > 0 ? Math.round((foundThemeWords.length / themeWords.length) * 100) : 0,
        words: themeWords,
        foundWords: foundThemeWords
      };
    }

    // Fallback to old theme analytics data if new theme words are not available
    if (themeAnalytics.themeAnalytics && (themeAnalytics.themeAnalytics as Record<string, unknown>)[themeName]) {
      // Backend structure: themeAnalytics.themeAnalytics[themeName]
      const themeData = (themeAnalytics.themeAnalytics as Record<string, unknown>)[themeName] as Record<string, unknown>;
      console.log(`🎯 Using OLD analytics data for ${themeName}:`, themeData);
      
      const wordsFound = (themeData.totalWordsFound as number) || 0;
      const totalWords = (themeData.totalPossibleWords as number) || 20;
      const foundWords = (themeData.wordsFound as Array<{word: string, date: string}>) || [];
      const completionPercent = totalWords > 0 ? Math.round((wordsFound / totalWords) * 100) : 0;

      return {
        wordsFound,
        totalWords,
        completionPercent,
        words: [], // We don't have the full word list in this response
        foundWords: foundWords.map(w => w.word)
      };
    }

    console.log('No theme data found for:', themeName);
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
    if (!ta) return undefined;
    const key = `${day}_progress`;
    const value = ta[key];
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

  // Fetch historical theme data for a specific date
  const fetchHistoricalThemeData = async (date: string) => {
    setLoadingHistoricalData(true);
    setHistoricalError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/proxy-theme-day?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch theme data: ${response.status}`);
      }

      const data = await response.json();
      console.log('Historical theme data:', data);
      setHistoricalThemeData(data);
    } catch (err) {
      console.error('Error fetching historical theme data:', err);
      setHistoricalError(err instanceof Error ? err.message : 'Failed to fetch theme data');
      setHistoricalThemeData(null);
    } finally {
      setLoadingHistoricalData(false);
    }
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

  // Handle time period filter change
  const handleTimePeriodFilter = async (period: string) => {
    console.log(`🕐 Changing time period filter to: ${period}`);
    setTimePeriodFilter(period);
    setShowCustomDateRange(false);
    
    // Fetch time analytics with the new filter
    try {
      const filters = period === 'ALL' ? {} : { period };
      const response = await apiService.getTimeAnalytics(filters);
      console.log('✅ Filtered time analytics response:', response);
      
      if (response && (response as Record<string, unknown>).analytics) {
        const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
        setTimeAnalytics(analytics);
      }
    } catch (error) {
      console.error('❌ Error fetching filtered time analytics:', error);
    }
  };

  // Handle custom date range
  const handleCustomDateRange = async () => {
    if (!customStartDate || !customEndDate) {
      alert('Please select both start and end dates');
      return;
    }
    
    console.log(`🕐 Applying custom date range: ${customStartDate} to ${customEndDate}`);
    setTimePeriodFilter('custom');
    
    try {
      const filters = { 
        period: 'custom',
        startDate: customStartDate,
        endDate: customEndDate
      };
      const response = await apiService.getTimeAnalytics(filters);
      console.log('✅ Custom date range time analytics response:', response);
      
      if (response && (response as Record<string, unknown>).analytics) {
        const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
        setTimeAnalytics(analytics);
      }
    } catch (error) {
      console.error('❌ Error fetching custom date range time analytics:', error);
    }
  };

  // Handle theme day click
  const handleThemeDayClick = async (day: string) => {
    console.log(`🎯 Fetching theme details for day: ${day}`);
    setSelectedThemeDay(day);
    setIsThemeModalOpen(true);
    console.log(`🎯 Modal opened for day: ${day}`);
    
    try {
      // Calculate the date for the selected day
      // Use UTC date to match mobile app theme schedule
      const today = new Date();
      const utcDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const dayOfWeek = utcDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayIndex = dayNames.indexOf(day);
      
      // Calculate the date for the selected day
      // If it's the current day and we have no data, try the previous week
      let daysUntilSelectedDay = selectedDayIndex - dayOfWeek;
      
      // If the selected day is in the future (next week), go back to previous week
      if (daysUntilSelectedDay > 0) {
        daysUntilSelectedDay -= 7; // Go back one week
      }
      
      const selectedDate = new Date(utcDate);
      selectedDate.setUTCDate(utcDate.getUTCDate() + daysUntilSelectedDay);
      const selectedDateString = selectedDate.toISOString().split('T')[0];
      
      console.log(`🎯 DEBUG: Today is ${utcDate.toISOString().split('T')[0]} (UTC day ${dayOfWeek})`);
      console.log(`🎯 DEBUG: Selected day is ${day} (index ${selectedDayIndex})`);
      console.log(`🎯 DEBUG: Days until selected day: ${daysUntilSelectedDay}`);
      console.log(`🎯 DEBUG: Calculated selected date: ${selectedDateString}`);
      
      // Fetch complete theme details for this specific day and date (direct backend call)
      const data = await apiService.getThemeDayStatistics(selectedDateString) as Record<string, unknown>;
      console.log('✅ Theme day details from backend:', data);
      
      if (data.success) {
        // Store the complete theme data
        setThemeAnalytics(prev => {
          const updated = {
            ...prev,
            [`${day}_themeDetails`]: data
          };
          console.log(`🎯 Updated themeAnalytics with complete details for ${day}`);
          console.log(`🎯 New themeAnalytics keys:`, Object.keys(updated));
          console.log(`🎯 Stored data for ${day}:`, data);
          return updated;
        });
      } else {
        console.log('❌ No theme data in response');
      }
    } catch (error) {
      console.error('❌ Error fetching theme day details:', error);
      
      // If authentication failed, show a message to the user
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        console.log('🔐 Authentication failed - user may need to sign in again');
        return;
      }
      
      // For other errors, show a fallback message
      console.log('⚠️ Using fallback theme words due to API error');
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
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-1 mb-8 shadow-2xl">
        <div className="rounded-3xl bg-gradient-to-br from-white/95 to-blue-50/95 text-blue-900 p-8 backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="relative w-28 h-28">
                  {profile.profileImageUrl && profile.profileImageUrl.trim() !== '' ? (
                    <Image
                      src={profile.profileImageUrl}
                      alt="Profile"
                      width={112}
                      height={112}
                      className="rounded-full border-4 border-white shadow-2xl w-28 h-28 object-cover"
                      onError={() => {
                        console.error('Profile image failed to load:', profile.profileImageUrl);
                      }}
                    />
                  ) : (
                    <div className="w-28 h-28 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-2xl">
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

            <div className="flex items-center gap-4">
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
            </div>
          </div>
        </div>
      </div>

      {/* Mission Reset Countdown */}
      <MissionResetCountdown variant="profile" className="mb-8" />

      {/* AI Assistant Modal */}
      {aiModalOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
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
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-xl text-blue-950">Game & Battle</h3>
              <p className="text-sm text-blue-700">Track your gaming performance and battle statistics</p>
            </div>
          </div>
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
          <div className="flex items-center gap-3 mb-6">
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
            <div className="flex items-center gap-2">
              {(["7d","30d","90d","1y","all","custom"] as const).map(r => (
                <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-sm border ${range===r? 'bg-blue-600 text-white border-blue-600':'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'}`}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          {/* Custom Date Range Picker */}
          {range === "custom" && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">Start Date</label>
                    <input 
                      type="date" 
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                      max={new Date().toISOString().split('T')[0]}
                      className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    />
              </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      if (customDateRange.start && customDateRange.end) {
                        const startDate = new Date(customDateRange.start);
                        const endDate = new Date(customDateRange.end);
                        
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
                        
                        console.log('Custom range selected:', customDateRange);
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
                if (range === "custom" && customDateRange.start && customDateRange.end) {
                  const startDate = new Date(customDateRange.start).toLocaleDateString();
                  const endDate = new Date(customDateRange.end).toLocaleDateString();
                  return `Custom Range: ${startDate} - ${endDate}`;
                } else if (range === "7d") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 7);
                  return `Last 7 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (range === "30d") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 30);
                  return `Last 30 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (range === "90d") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setDate(endDate.getDate() - 90);
                  return `Last 90 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (range === "1y") {
                  const endDate = new Date();
                  const startDate = new Date();
                  startDate.setFullYear(endDate.getFullYear() - 1);
                  return `Last Year: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                } else if (range === "all") {
                  return "All Time Data";
                }
                return "Select a date range";
              })()}
            </p>
          </div>
          <Sparkline data={(historyDays && historyDays.length > 0) ? historyDays : aggregated(profile).days} height={260} color="#4f46e5" />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MiniStat title="Words (found)" value={profile.allFoundWords.length.toLocaleString()} />
            <MiniStat title="Avg/Day" value={historyMetrics.avgPerDay} />
            <MiniStat title="Avg Length" value={historyMetrics.avgLength.toFixed(1)} />
          </div>
        </div>

        {/* Activity Snapshot */}
        <div className="bg-white rounded-xl p-5 shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
          </div>
          <div>
              <h3 className="font-bold text-lg text-blue-950">Activity Snapshot</h3>
              <p className="text-xs text-blue-700">Quick overview of your current status</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-blue-900">
            <div className="flex items-center justify-between"><span>Leaderboard Placements</span><span className="font-semibold">{profile.leaderboardPlacements}</span></div>
            <div className="flex items-center justify-between"><span>Current Level</span><span className="font-semibold">{profile.highestLevel}</span></div>
          </div>
        </div>
      </div>

      {/* Session Words History */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-lg border border-green-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl text-green-950">Session Words History</h3>
            <p className="text-sm text-green-700">Total words found per day across all game sessions. This shows your daily word discovery progress.</p>
            <p className="text-xs text-green-600 mt-1">Note: The displayed word count is for newly found words (excluding duplicates).</p>
          </div>
          <div className="flex items-center gap-2">
            {(["7d","30d","90d","1y","all","custom"] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-sm border ${range===r? 'bg-green-600 text-white border-green-600':'bg-white text-green-800 border-green-200 hover:bg-green-50'}`}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        {/* Custom Date Range Picker */}
        {range === "custom" && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                  />
            </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => {
                    if (customDateRange.start && customDateRange.end) {
                      const startDate = new Date(customDateRange.start);
                      const endDate = new Date(customDateRange.end);
                      
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
                      
                      console.log('Custom range selected:', customDateRange);
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
              if (range === "custom" && customDateRange.start && customDateRange.end) {
                const startDate = new Date(customDateRange.start).toLocaleDateString();
                const endDate = new Date(customDateRange.end).toLocaleDateString();
                return `Custom Range: ${startDate} - ${endDate}`;
              } else if (range === "7d") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 7);
                return `Last 7 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (range === "30d") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 30);
                return `Last 30 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (range === "90d") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 90);
                return `Last 90 Days: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (range === "1y") {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setFullYear(endDate.getFullYear() - 1);
                return `Last Year: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
              } else if (range === "all") {
                return "All Time Data";
              }
              return "Select a date range";
            })()}
          </p>
        </div>
        
        <Sparkline data={sessionWordsDays || []} height={260} color="#10b981" />
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
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
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
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
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
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
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
            const themeData = getThemeData('monday');
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

          {/* Thursday - Animals */}
          {(() => {
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
                  <p className="text-lg font-bold text-gray-500">{getThemeName('thursday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => {
                      const p = getProgressFor('thursday');
                      return p ? `${p.found}/${p.total} theme words` : 'No data available';
                    })()}
                  </div>
                </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('thursday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">⭐</span>
            </div>
                  <span className="text-xs text-purple-600 font-semibold">THURSDAY</span>
                </div>
                <p className="text-lg font-bold text-purple-900">{getThemeName('thursday')}</p>
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
          </div>

        {/* Additional Theme Days */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Friday - Adjectives */}
          {(() => {
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
                  <p className="text-lg font-bold text-gray-500">{getThemeName('friday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => {
                      const p = getProgressFor('friday');
                      return p ? `${p.found}/${p.total} theme words` : 'No data available';
                    })()}
                  </div>
        </div>
              );
            }
            return (
              <div 
                className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleThemeDayClick('friday')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🐕</span>
            </div>
                  <span className="text-xs text-yellow-600 font-semibold">FRIDAY</span>
          </div>
                <p className="text-lg font-bold text-yellow-900">{getThemeName('friday')}</p>
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

          {/* Saturday - Colors */}
          {(() => {
            const themeData = getThemeData('saturday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('saturday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🌳</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">SATURDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('saturday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => {
                      const p = getProgressFor('saturday');
                      return p ? `${p.found}/${p.total} theme words` : 'No data available';
                    })()}
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
                    <span className="text-white font-bold text-sm">🌳</span>
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

          {/* Sunday - Animals */}
          {(() => {
            const themeData = getThemeData('sunday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                  onClick={() => handleThemeDayClick('sunday')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">📱</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">SUNDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('sunday')}</p>
                  <div className="mt-3 text-center text-gray-600 text-sm font-medium">
                    {(() => {
                      const p = getProgressFor('sunday');
                      return p ? `${p.found}/${p.total} theme words` : 'No data available';
                    })()}
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
                    <span className="text-white font-bold text-sm">📱</span>
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
            <a
              href="/theme-history"
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-100 hover:bg-violet-200 rounded-lg transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              View History
            </a>
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

        {/* Historical Theme Analytics */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-900">Historical Theme Performance</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={selectedHistoricalDate}
                max={new Date().toISOString().split('T')[0]}
                min={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedHistoricalDate(e.target.value);
                    fetchHistoricalThemeData(e.target.value);
                  }
                }}
              />
            </div>
            
            {/* Quick Date Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Select
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setSelectedHistoricalDate(today);
                    fetchHistoricalThemeData(today);
                  }}
                  className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setSelectedHistoricalDate(yesterday);
                    fetchHistoricalThemeData(yesterday);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Yesterday
                </button>
                <button
                  onClick={() => {
                    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setSelectedHistoricalDate(lastWeek);
                    fetchHistoricalThemeData(lastWeek);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Last Week
                </button>
                <button
                  onClick={() => {
                    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setSelectedHistoricalDate(lastMonth);
                    fetchHistoricalThemeData(lastMonth);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Last Month
                </button>
              </div>
            </div>
          </div>
          
          {/* Historical Data Display */}
          <div className="mt-4">
            {loadingHistoricalData && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-blue-700">Loading theme data...</span>
                </div>
              </div>
            )}

            {historicalError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading theme data</h3>
                    <div className="mt-2 text-sm text-red-700">{historicalError}</div>
                  </div>
                </div>
              </div>
            )}

            {historicalThemeData && !loadingHistoricalData && (
              <div className="space-y-4">
                {/* Header Info */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {new Date(selectedHistoricalDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {historicalThemeData.theme?.name || 'Unknown Theme'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        (historicalThemeData.stats?.completionRate || 0) >= 100 
                          ? 'text-green-600 bg-green-100' 
                          : (historicalThemeData.stats?.completionRate || 0) >= 75
                          ? 'text-blue-600 bg-blue-100'
                          : (historicalThemeData.stats?.completionRate || 0) >= 50
                          ? 'text-yellow-600 bg-yellow-100'
                          : 'text-red-600 bg-red-100'
                      }`}>
                        {historicalThemeData.stats?.completionRate || 0}% Complete
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {historicalThemeData.stats?.totalThemeWordsFound || 0}
                    </div>
                    <div className="text-sm text-gray-600">Words Found</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {historicalThemeData.theme?.words?.length || 20}
                    </div>
                    <div className="text-sm text-gray-600">Total Words</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {historicalThemeData.stats?.isCompleted ? '✅' : '⏳'}
                    </div>
                    <div className="text-sm text-gray-600">Status</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm text-gray-600">
                      {historicalThemeData.stats?.totalThemeWordsFound || 0} / {historicalThemeData.theme?.words?.length || 20}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${historicalThemeData.stats?.completionRate || 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Theme Words Grid */}
                {historicalThemeData.allThemeWords && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Theme Words</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {historicalThemeData.allThemeWords.map((wordData: { word: string; found: boolean }, index: number) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                            wordData.found
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-center">
                            {wordData.found && (
                              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            {wordData.word}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-blue-900 mb-2">Performance Summary</h4>
                  <div className="text-sm text-blue-800">
                    {historicalThemeData.stats?.isCompleted ? (
                      <p>🎉 Congratulations! You completed the {historicalThemeData.theme?.name} theme on {new Date(selectedHistoricalDate).toLocaleDateString()}!</p>
                    ) : (
                      <p>
                        You found {historicalThemeData.stats?.totalThemeWordsFound || 0} out of {historicalThemeData.theme?.words?.length || 20} words 
                        ({historicalThemeData.stats?.completionRate || 0}% complete) for the {historicalThemeData.theme?.name} theme.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!selectedHistoricalDate && !loadingHistoricalData && !historicalError && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-center text-gray-600">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Select a date to view historical theme performance</p>
                  <p className="text-xs text-gray-500 mt-1">View your daily theme progress for any past date</p>
                </div>
              </div>
            )}
          </div>
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
          </div>
        </div>
        

        {/* Time Period Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance by Time Period</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTimePeriodFilter('L7')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  timePeriodFilter === 'L7' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handleTimePeriodFilter('L30')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  timePeriodFilter === 'L30' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handleTimePeriodFilter('ALL')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  timePeriodFilter === 'ALL' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setShowCustomDateRange(!showCustomDateRange)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  showCustomDateRange 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>
          
          {/* Custom Date Range Picker */}
          {showCustomDateRange && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleCustomDateRange}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  Apply Range
                </button>
                <button
                  onClick={() => setShowCustomDateRange(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Time Period Reference */}
        <div className="mb-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <div className="font-semibold mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time Period Reference
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <div className="font-medium text-blue-800">Late Night</div>
                <div className="text-blue-600">12AM-4AM UTC</div>
                <div className="text-blue-500">7PM-11PM EST</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-blue-800">Early Morning</div>
                <div className="text-blue-600">5AM-9AM UTC</div>
                <div className="text-blue-500">12AM-4AM EST</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-blue-800">Late Morning</div>
                <div className="text-blue-600">10AM-12PM UTC</div>
                <div className="text-blue-500">5AM-7AM EST</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-blue-800">Afternoon</div>
                <div className="text-blue-600">1PM-5PM UTC</div>
                <div className="text-blue-500">8AM-12PM EST</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-blue-800">Evening</div>
                <div className="text-blue-600">6PM-11PM UTC</div>
                <div className="text-blue-500">1PM-6PM EST</div>
              </div>
              <div className="space-y-1">
                <div className="text-blue-500 text-xs italic">
                  Times are calculated in UTC for consistency across all users worldwide.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Period Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Late Night (12AM - 4AM) */}
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodData = getTimePeriodData('late-night') as any;
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
                  <p className="text-lg font-bold text-gray-500">12:00 AM - 4:00 AM</p>
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
                <p className="text-lg font-bold text-indigo-900">12:00 AM - 4:00 AM</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">EARLY MORNING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">5:00 AM - 9:00 AM</p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
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
                <p className="text-lg font-bold text-amber-900">5:00 AM - 9:00 AM</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">LATE MORNING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">10:00 AM - 12:00 PM</p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
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
                <p className="text-lg font-bold text-blue-900">10:00 AM - 12:00 PM</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">AFTERNOON</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">1:00 PM - 5:00 PM</p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
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
                <p className="text-lg font-bold text-green-900">1:00 PM - 5:00 PM</p>
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
                  <p className="text-lg font-bold text-gray-500">6:00 PM - 11:00 PM</p>
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
                <p className="text-lg font-bold text-purple-900">6:00 PM - 11:00 PM</p>
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
                  const periodNames = ['12:00 AM - 4:00 AM', '5:00 AM - 9:00 AM', '10:00 AM - 12:00 PM', '1:00 PM - 5:00 PM', '6:00 PM - 11:00 PM'];
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
                { key: 'late-night', label: '12AM-4AM', color: 'indigo' },
                { key: 'early-morning', label: '5AM-9AM', color: 'amber' },
                { key: 'late-morning', label: '10AM-12PM', color: 'blue' },
                { key: 'afternoon', label: '1PM-5PM', color: 'green' },
                { key: 'evening', label: '6PM-11PM', color: 'purple' }
              ];
              
              return periods.map(period => {
                const data = getTimePeriodData(period.key);
                if (!data) return null;
                const maxWords = Math.max(...periods.map(p => {
                  const pData = getTimePeriodData(p.key);
                  return pData ? pData.wordsFound : 0;
                }), 1);
                const width = maxWords > 0 ? (data.wordsFound / maxWords) * 100 : 0;
                
                return (
                  <div key={period.key} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-600">{period.label}</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsExplorerOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden border border-gray-200">
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
                                          {row.first.toLocaleDateString()}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-gray-700">
                                        <div className="flex items-center gap-2">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          {row.last.toLocaleDateString()}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
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

function Sparkline({ data, height = 240, color = '#4f46e5' }: { data: { date: Date; value: number; words?: string[] }[]; height?: number; color?: string }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  // Selected point persists on click to show exact value even when axis ticks skip values
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  
  const chartHeight = height - 80; // Much more space for labels
  const leftMargin = 80; // Slightly reduced to free up width
  const rightMargin = 30;
  const topMargin = 60; // extra headroom for hover labels
  const bottomMargin = 60; // More space for X labels
  const width = Math.min(1024, Math.max(520, data.length * 10) + leftMargin + rightMargin); // Wider cap and base
  const max = Math.max(1, ...data.map(d => d.value));
  
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * (width - leftMargin - rightMargin) + leftMargin;
    const y = chartHeight - (d.value / max) * (chartHeight - topMargin - bottomMargin) - bottomMargin;
    return { x, y, data: d, index: i };
  });
  
  const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${leftMargin},${chartHeight-bottomMargin} ${pointsString} ${width-rightMargin},${chartHeight-bottomMargin}`;
  
  // Generate date labels (show every nth date to avoid crowding)
  const labelInterval = Math.max(1, Math.floor(data.length / 6));
  const dateLabels = data.filter((_, i) => i % labelInterval === 0 || i === data.length - 1);
  
  const handlePointHover = (index: number) => {
    setHoveredPoint(index);
  };
  
  const handlePointLeave = () => {
    setHoveredPoint(null);
  };
  
  const handlePointClick = (index: number) => {
    // Toggle selection if clicking the same point
    setSelectedPoint(prev => (prev === index ? null : index));
  };
  
  return (
    <div className="w-full bg-white rounded-lg p-4 border border-gray-200">
      <div className="w-full overflow-hidden">
        <svg 
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block cursor-pointer"
          onMouseLeave={handlePointLeave}
          onClick={() => {
            // Clicking the background clears selection
            setSelectedPoint(null);
          }}
        >
        {/* Grid lines */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        
        {/* Grid lines removed to prevent tooltip interference */}
        
        {/* Area under the curve */}
        <polyline points={area} fill="url(#areaGradient)" stroke="none" />
        
        {/* Main line with gradient */}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8"/>
            <stop offset="100%" stopColor={color} stopOpacity="1"/>
          </linearGradient>
        </defs>
        <polyline 
          points={pointsString} 
          fill="none" 
          stroke="url(#lineGradient)" 
          strokeWidth="4" 
          strokeLinejoin="round" 
          strokeLinecap="round"
          className="transition-all duration-200"
        />
        
        {/* Interactive data points */}
        {points.map((point, i) => (
          <g key={i}>
            {/* Invisible larger hit area for better interaction */}
            <circle 
              cx={point.x} 
              cy={point.y} 
              r="12" 
              fill="transparent" 
              onMouseEnter={() => handlePointHover(i)}
              onMouseMove={() => handlePointHover(i)}
              onClick={(e) => {
                e.stopPropagation();
                handlePointClick(i);
              }}
              className="cursor-pointer"
            />
            {/* Visible point */}
            <circle 
              cx={point.x} 
              cy={point.y} 
              r={hoveredPoint === i ? "7" : "5"} 
              fill={hoveredPoint === i ? "#ffffff" : color}
              stroke={hoveredPoint === i ? color : "#ffffff"}
              strokeWidth={hoveredPoint === i ? "4" : "3"}
              className="transition-all duration-200 drop-shadow-lg"
            />
          </g>
        ))}

        {/* Tooltips layer - rendered on top of everything */}
        <g style={{ zIndex: 10 }}>
          {/* Hover value label as SVG (more reliable than HTML overlay) */}
          {hoveredPoint !== null && points[hoveredPoint] && (
            <g>
              {(() => {
                const p = points[hoveredPoint];
                const labelY = Math.max(16, p.y - 28);
                const title = p.data.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const valueLabel = `${p.data.value} words`;
                const words = p.data.words || [];
                
              // Format words with line breaks for better fit
              const formatWords = (wordList: string[]) => {
                if (wordList.length === 0) return ['No new words'];
                if (wordList.length <= 3) return [wordList.join(', ')];
                
                // Split into multiple lines for better fit
                const words = wordList.slice(0, 6); // Show up to 6 words
                const lines = [];
                for (let i = 0; i < words.length; i += 3) {
                  const lineWords = words.slice(i, i + 3);
                  lines.push(lineWords.join(', '));
                }
                if (wordList.length > 6) {
                  lines[lines.length - 1] += ` and ${wordList.length - 6} more`;
                }
                return lines;
              };
                
                const wordsText = formatWords(words);
                
              // Calculate dimensions with better width estimation and centering
              const titleWidth = title.length * 7;
              const valueWidth = valueLabel.length * 7;
              const wordsWidth = Math.max(...wordsText.map(line => line.length * 6));
              const maxWidth = Math.max(titleWidth, valueWidth, wordsWidth) + 40; // More padding
              const textWidth = Math.max(maxWidth, 200); // Minimum width increased
                
                // Calculate tooltip position with edge detection
                let rectX = p.x - textWidth / 2;
                const rectY = labelY - 32;
                const rectHeight = 40 + (wordsText.length - 1) * 12; // Dynamic height based on lines
                
                // Adjust position if tooltip would go off-screen
                const rightEdge = width - rightMargin;
                const leftEdge = leftMargin;
                
                if (rectX + textWidth > rightEdge) {
                  // Tooltip would go off right edge, position it to the left of the point
                  rectX = p.x - textWidth - 10;
                } else if (rectX < leftEdge) {
                  // Tooltip would go off left edge, position it to the right of the point
                  rectX = p.x + 10;
                }
                
                return (
                  <g>
                    {/* Simple white background to block grid lines */}
                    <rect x={rectX - 4} y={rectY - 4} rx="12" ry="12" width={textWidth + 8} height={rectHeight + 8} fill="#ffffff" stroke="none" />
                    {/* Dark background for tooltip */}
                    <rect x={rectX} y={rectY} rx="8" ry="8" width={textWidth} height={rectHeight} fill="#111827" stroke="#374151" strokeWidth="1" />
                    
                    {/* Calculate text X position based on tooltip position */}
                    {(() => {
                      const textX = rectX + textWidth / 2;
                      return (
                        <>
                          <text x={textX} y={rectY + 14} textAnchor="middle" fill="#93c5fd" fontSize="11" fontWeight="700">{title}</text>
                          <text x={textX} y={rectY + 26} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700">{valueLabel}</text>
                          
                          {/* Multi-line word text with proper centering */}
                          {wordsText.map((line, index) => (
                            <text 
                              key={index}
                              x={textX} 
                              y={rectY + 38 + (index * 12)} 
                              textAnchor="middle" 
                              fill="#d1d5db" 
                              fontSize="10" 
                              fontWeight="500"
                            >
                              {line}
                            </text>
                          ))}
                        </>
                      );
                    })()}
                  </g>
                );
              })()}
            </g>
          )}

          {/* Pinned value label for selected point */}
          {selectedPoint !== null && points[selectedPoint] && (
            <g>
              {(() => {
                const p = points[selectedPoint];
                const labelY = Math.max(16, p.y - 18);
                const label = String(p.data.value);
                const padX = 10;
                const padY = 6;
                const approxWidth = label.length * 7 + padX * 2; // rough text width estimate
                const rectX = p.x - approxWidth / 2;
                const rectY = labelY - (padY * 2);
                return (
                  <g>
                    {/* Simple white background to block grid lines */}
                    <rect x={rectX - 4} y={rectY - 4} rx="12" ry="12" width={approxWidth + 8} height={padY * 2 + 16} fill="#ffffff" stroke="none" />
                    {/* Dark background for tooltip */}
                    <rect x={rectX} y={rectY} rx="8" ry="8" width={approxWidth} height={padY * 2 + 8} fill="#111827" opacity="0.9" />
                    <text x={p.x} y={labelY} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700">{label}</text>
                  </g>
                );
              })()}
            </g>
          )}
        </g>
        
        {/* Date labels - Better spacing and larger font */}
        {dateLabels.map((d, i) => {
          const originalIndex = data.findIndex(item => item.date.getTime() === d.date.getTime());
          console.log('🔍 Date label debug:', { 
            labelDate: d.date, 
            labelDateString: d.date.toLocaleDateString(),
            originalIndex,
            dataLength: data.length,
            lastDataPoint: data[data.length - 1]?.date,
            lastDataPointString: data[data.length - 1]?.date?.toLocaleDateString()
          });
          const x = (originalIndex / Math.max(1, data.length - 1)) * (width - leftMargin - rightMargin) + leftMargin;
          return (
            <g key={i}>
              <text 
                x={x} 
                y={chartHeight + 25} 
                textAnchor="middle" 
                className="fill-gray-700 font-semibold"
                fontSize="12"
              >
                {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            </g>
          );
        })}
        
        {/* Y-axis labels - Much better spacing and distribution */}
        {(() => {
          // Create better distributed Y-axis labels with much more spacing
          const numLabels = 5; // 5 labels for better distribution
          const labels = [];
          
          // Create evenly distributed labels
          for (let i = 0; i < numLabels; i++) {
            const value = Math.round((max / (numLabels - 1)) * i);
            labels.push(value);
          }
          
          // Ensure we always have 0 and max
          if (labels[0] !== 0) labels[0] = 0;
          if (labels[labels.length - 1] !== max) labels[labels.length - 1] = max;
          
          return labels.map((value, i) => {
            const ratio = max > 0 ? value / max : 0;
            const y = chartHeight - (ratio * (chartHeight - topMargin - bottomMargin)) - bottomMargin;
            return (
              <g key={i}>
                {/* Grid line */}
                {/* Grid line removed to prevent tooltip interference */}
                {/* Label */}
                <text 
                  x={leftMargin - 15} 
                  y={y + 5} 
                  textAnchor="end" 
                  className="fill-gray-700 font-semibold"
                  fontSize="12"
                >
                  {value}
                </text>
              </g>
            );
          });
        })()}
      </svg>
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
