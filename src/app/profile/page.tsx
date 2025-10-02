"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService, UserProfile } from "@/services/api";

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
    const dayCounts = new Map<string, { date: Date; count: number; avgLenSum: number; lenCount: number }>();
    entries.forEach((e) => {
      // Filter entries to only include those within the date range
      if (e.date < start || e.date > endDate) return;
      const k = keyOf(e.date);
      if (!dayCounts.has(k)) dayCounts.set(k, { date: new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()), count: 0, avgLenSum: 0, lenCount: 0 });
      const rec = dayCounts.get(k)!;
      rec.count += 1;
      rec.avgLenSum += e.word.length;
      rec.lenCount += 1;
    });
    

    const days: { date: Date; value: number; avgLen?: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= endDate) {
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
  }, [range, customDateRange]); // Add dependencies for the aggregated function

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
  }, [range, customDateRange]);

  // Load session words data
  useEffect(() => {
    const loadSessionWords = async () => {
      try {
        if (!apiService.isAuthenticated()) return;
        
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

        const res = await apiService.getUserSessionWords({ range: mapRange(range) });
        const daysFromApi = Array.isArray(res.days) ? res.days.map(d => ({
          date: new Date(d.date),
          value: typeof d.value === 'number' ? d.value : 0,
          avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined
        })) : [];
        
        // For custom range, filter client-side after getting all data
        if (range === "custom" && customDateRange.start && customDateRange.end) {
          const startDate = new Date(customDateRange.start + 'T00:00:00');
          const endDate = new Date(customDateRange.end + 'T23:59:59');
          
          const filteredData = daysFromApi.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= startDate && dataDate <= endDate;
          });
          setSessionWordsDays(filteredData);
        } else {
          setSessionWordsDays(daysFromApi);
        }
      } catch (error) {
        console.warn('Falling back to client aggregation for session words:', error);
        setSessionWordsDays(null);
      }
    };
    loadSessionWords();
  }, [range, customDateRange]);


  const fetchProfile = useCallback(async () => {
    try {
      // Data refreshes on mount/route
      
        if (!apiService.isAuthenticated()) {
          router.push("/signin");
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
      } catch (error) {
        console.error("Profile fetch error:", error);
        setError(error instanceof Error ? error.message : "Failed to load profile");
        if (error instanceof Error && error.message.includes("Authentication failed")) {
          router.push("/signin");
        }
      } finally {
        setLoading(false);
      // Removed: manual refresh state (data refreshes on mount/route)
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
          const dayIdx = today.getDay(); // 0=Sun..6=Sat
          const sunday = new Date(today);
          sunday.setDate(today.getDate() - dayIdx);
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
            dateObj.setDate(sunday.getDate() + i);
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

  const handleAiQuery = () => {
    if (!aiQuery.trim() || !profile) return;
    
    const query = aiQuery.toLowerCase();
    let response = '';
    
    // AI responses based on user data
    if (query.includes('words') || query.includes('word')) {
      const totalWords = profile.allFoundWords.length;
      response = `You have found ${totalWords.toLocaleString()} words total!`;
    } else if (query.includes('level') || query.includes('levels')) {
      response = `You are currently at Level ${profile.highestLevel}!`;
    } else if (query.includes('win') || query.includes('rate') || query.includes('percentage')) {
      const rate = winRate(profile);
      response = `Your win rate is ${rate}% (${profile.battleWins} wins, ${profile.battleLosses} losses).`;
    } else if (query.includes('games') || query.includes('played')) {
      response = `You have played ${profile.gamesPlayed} games total.`;
    } else if (query.includes('coins') || query.includes('flectcoins')) {
      response = `You have ${profile.flectcoins.toLocaleString()} Flectcoins!`;
    } else if (query.includes('points')) {
      response = `You have ${profile.points.toLocaleString()} points!`;
    } else if (query.includes('gems')) {
      response = `You have ${profile.gems.toLocaleString()} gems!`;
    } else if (query.includes('battles') || query.includes('battle')) {
      response = `You have ${profile.battleWins} battle wins and ${profile.battleLosses} battle losses.`;
    } else if (query.includes('time') || query.includes('play time')) {
      const totalMinutes = usageMetrics.totalPlayTimeMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      response = `You have played for ${hours} hours and ${minutes} minutes total.`;
    } else if (query.includes('streak') || query.includes('current streak')) {
      response = `Your current streak is ${usageMetrics.currentStreakDays} days.`;
    } else if (query.includes('longest streak')) {
      response = `Your longest streak was ${usageMetrics.longestStreakDays} days.`;
    } else if (query.includes('days') || query.includes('active')) {
      response = `You have been active for ${usageMetrics.daysLoggedIn} days.`;
    } else {
      response = `I can help you with information about your words found, level, win rate, games played, coins, points, gems, battles, play time, streaks, and activity. Try asking about any of these!`;
    }
    
    setAiResponse(response);
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
      
      // Calculate the date for the selected day
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayIndex = dayNames.indexOf(day);
      
      // Calculate the date for the selected day (this week)
      const daysUntilSelectedDay = selectedDayIndex - dayOfWeek;
      const selectedDate = new Date(today);
      selectedDate.setDate(today.getDate() + daysUntilSelectedDay);
      const selectedDateString = selectedDate.toISOString().split('T')[0];
      
      console.log(`🎯 DEBUG: Today is ${today.toISOString().split('T')[0]} (day ${dayOfWeek})`);
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
            ['PEPPER', 'SALT', 'SUGAR', 'FLOUR', 'EGG', 'BUTTER', 'OIL', 'VINEGAR', 'MUSTARD', 'KETCHUP', 'MAYO', 'RELIEF', 'SPICE', 'HERB', 'NUT', 'SEED', 'BEAN', 'LENTIL', 'QUINOA', 'OAT']
          ]
        },
        tuesday: {
          name: 'Common Nouns',
          sets: [
            ['HOUSE', 'CAR', 'TREE', 'BOOK', 'PHONE', 'CHAIR', 'TABLE', 'DOOR', 'WINDOW', 'CLOCK', 'MONEY', 'MUSIC', 'FAMILY', 'FRIEND', 'SCHOOL', 'WORK', 'GAME', 'MOVIE', 'STORY', 'DREAM'],
            ['BED', 'SOFA', 'DESK', 'LAMP', 'MIRROR', 'PICTURE', 'CLOCK', 'CALENDAR', 'PEN', 'PAPER', 'BAG', 'BOX', 'BOTTLE', 'CUP', 'PLATE', 'BOWL', 'SPOON', 'FORK', 'KNIFE', 'GLASS'],
            ['SHIRT', 'PANTS', 'SHOES', 'HAT', 'COAT', 'DRESS', 'SKIRT', 'JACKET', 'SWEATER', 'SOCKS', 'GLOVES', 'SCARF', 'BELT', 'WATCH', 'RING', 'NECKLACE', 'BRACELET', 'EARRINGS', 'SUNGLASSES', 'UMBRELLA'],
            ['TOY', 'DOLL', 'BALL', 'PUZZLE', 'BLOCK', 'CRAYON', 'MARKER', 'PAINT', 'BRUSH', 'CANVAS', 'CLAY', 'SCISSORS', 'GLUE', 'TAPE', 'STAPLER', 'CLIP', 'RUBBER', 'ERASER', 'RULER', 'PENCIL']
          ]
        },
        wednesday: {
          name: 'Nature',
          sets: [
            ['RUN', 'WALK', 'JUMP', 'SWIM', 'DANCE', 'SING', 'READ', 'WRITE', 'DRAW', 'PAINT', 'COOK', 'CLEAN', 'LEARN', 'TEACH', 'HELP', 'LOVE', 'THINK', 'DREAM', 'CREATE', 'BUILD'],
            ['PLAY', 'WORK', 'STUDY', 'SLEEP', 'EAT', 'DRINK', 'TALK', 'LISTEN', 'WATCH', 'LOOK', 'SEE', 'HEAR', 'FEEL', 'TOUCH', 'HOLD', 'CARRY', 'PUSH', 'PULL', 'LIFT', 'DROP'],
            ['OPEN', 'CLOSE', 'START', 'STOP', 'BEGIN', 'END', 'FINISH', 'COMPLETE', 'CONTINUE', 'PAUSE', 'WAIT', 'HURRY', 'RUSH', 'SLOW', 'SPEED', 'ACCELERATE', 'BRAKE', 'TURN', 'STRAIGHT', 'CURVE'],
            ['CLIMB', 'DESCEND', 'ASCEND', 'RISE', 'FALL', 'SINK', 'FLOAT', 'FLY', 'SOAR', 'GLIDE', 'SLIDE', 'SKIP', 'HOP', 'LEAP', 'BOUNCE', 'ROLL', 'SPIN', 'TWIST', 'BEND', 'STRETCH']
          ]
        },
        thursday: {
          name: 'Adjectives',
          sets: [
            ['BIG', 'SMALL', 'FAST', 'SLOW', 'HOT', 'COLD', 'NEW', 'OLD', 'GOOD', 'BAD', 'HAPPY', 'SAD', 'BEAUTIFUL', 'STRONG', 'SMART', 'FUNNY', 'QUIET', 'LOUD', 'BRIGHT', 'DARK'],
            ['TALL', 'SHORT', 'WIDE', 'NARROW', 'THICK', 'THIN', 'HEAVY', 'LIGHT', 'HARD', 'SOFT', 'SMOOTH', 'ROUGH', 'SHARP', 'DULL', 'CLEAN', 'DIRTY', 'WET', 'DRY', 'FULL', 'EMPTY'],
            ['RICH', 'POOR', 'YOUNG', 'ELDERLY', 'HEALTHY', 'SICK', 'SAFE', 'DANGEROUS', 'EASY', 'DIFFICULT', 'SIMPLE', 'COMPLEX', 'CLEAR', 'FOGGY', 'SUNNY', 'CLOUDY', 'WINDY', 'CALM', 'STORMY', 'PEACEFUL'],
            ['FRIENDLY', 'SHY', 'WISE', 'HONEST', 'FAIR', 'BRAVE', 'SOFT', 'HARD', 'WARM', 'COOL', 'DRY', 'WET', 'HEAVY', 'LIGHT', 'THICK', 'THIN', 'WIDE', 'NARROW', 'DEEP', 'SHALLOW']
          ]
        },
        friday: {
          name: 'Animals',
          sets: [
            ['DOG', 'CAT', 'BIRD', 'FISH', 'BEAR', 'LION', 'TIGER', 'ELEPHANT', 'MONKEY', 'RABBIT', 'MOUSE', 'SNAKE', 'HORSE', 'COW', 'PIG', 'SHEEP', 'GOAT', 'CHICKEN', 'DUCK', 'OWL'],
            ['EAGLE', 'WOLF', 'FOX', 'DEER', 'SEAL', 'WHALE', 'SHARK', 'CRAB', 'SNAIL', 'SPIDER', 'HAMSTER', 'TURTLE', 'LIZARD', 'GECKO', 'IGUANA', 'NEWT', 'TOAD', 'LADYBUG', 'DRAGONFLY', 'BUTTERFLY'],
            ['PANDA', 'KOALA', 'MUSSEL', 'SCALLOP', 'TUNA', 'SALMON', 'TROUT', 'BASS', 'PIKE', 'PERCH', 'CARP', 'GOLDFISH', 'DOLPHIN', 'OTTER', 'BEAVER', 'RACCOON', 'SKUNK', 'POSSUM', 'BAT', 'SQUIRREL'],
            ['CAT', 'DOG', 'LION', 'TIGER', 'EAGLE', 'BEAR', 'WOLF', 'FOX', 'DEER', 'RABBIT', 'COW', 'PIG', 'CHICKEN', 'DUCK', 'GOOSE', 'TURKEY', 'SEAL', 'WHALE', 'SHARK', 'CRAB']
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
            ['PHONE', 'COMPUTER', 'INTERNET', 'EMAIL', 'WEBSITE', 'APP', 'VIDEO', 'AUDIO', 'CAMERA', 'SCREEN', 'KEYBOARD', 'MOUSE', 'TABLET', 'LAPTOP', 'WIFI', 'BLUETOOTH', 'BATTERY', 'CHARGER', 'HEADPHONES', 'SPEAKER'],
            ['SMARTPHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER', 'SCANNER', 'ROUTER', 'MODEM', 'SERVER', 'CLOUD', 'DATABASE', 'SOFTWARE', 'HARDWARE', 'PROCESSOR', 'MEMORY', 'STORAGE', 'NETWORK', 'BROADBAND', 'FIBER'],
            ['ALGORITHM', 'PROGRAM', 'CODE', 'SCRIPT', 'FUNCTION', 'VARIABLE', 'ARRAY', 'OBJECT', 'CLASS', 'METHOD', 'INTERFACE', 'API', 'SDK', 'FRAMEWORK', 'LIBRARY', 'PLUGIN', 'EXTENSION', 'WIDGET', 'GADGET', 'DEVICE'],
            ['ARTIFICIAL', 'INTELLIGENCE', 'MACHINE', 'LEARNING', 'NEURAL', 'NETWORK', 'DEEP', 'LEARNING', 'ALGORITHM', 'DATA', 'ANALYTICS', 'BIG', 'DATA', 'BLOCKCHAIN', 'CRYPTOCURRENCY', 'BITCOIN', 'ETHEREUM', 'SMART', 'CONTRACT', 'DECENTRALIZED']
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
      // Use local date to avoid timezone issues
      const today = new Date();
      const localDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const dayOfWeek = localDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayIndex = dayNames.indexOf(day);
      
      // Calculate the date for the selected day (this week)
      const daysUntilSelectedDay = selectedDayIndex - dayOfWeek;
      const selectedDate = new Date(localDate);
      selectedDate.setDate(localDate.getDate() + daysUntilSelectedDay);
      const selectedDateString = selectedDate.toISOString().split('T')[0];
      
      console.log(`🎯 DEBUG: Today is ${localDate.toISOString().split('T')[0]} (day ${dayOfWeek})`);
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
                onClick={() => setAiModalOpen(true)}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:scale-105 transition-all duration-200 font-bold shadow-lg flex items-center gap-3 hover:shadow-xl border-2 border-emerald-400/20 hover:border-emerald-300/40"
              >
                <div className="relative">
                  <svg className="h-5 w-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                </div>
                AI Assistant
              </button>
              <a href="/dashboard">
                <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:scale-105 transition-all duration-200 font-bold shadow-lg flex items-center gap-3 hover:shadow-xl">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
                  </svg>
                  Dashboard
                </button>
              </a>
              <button 
                onClick={handleSignOut} 
                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl hover:scale-105 transition-all duration-200 font-bold shadow-lg flex items-center gap-3 hover:shadow-xl"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {aiModalOpen ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">AI Assistant</h3>
              <button 
                onClick={() => {
                  setAiModalOpen(false);
                  setAiQuery('');
                  setAiResponse('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Ask me about your stats! Try: How many words have I found? or What&apos;s my win rate?
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask about your stats..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                />
                <button
                  onClick={handleAiQuery}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Ask
                </button>
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
                  <p className="text-gray-800 font-medium">{aiResponse}</p>
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
              <p className="text-sm text-blue-700">View your word discovery trends over time</p>
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
            <p className="text-sm text-green-700">Total words found per day across all game sessions (including duplicates)</p>
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
              {usageMetrics.totalPlayTimeMinutes !== undefined
                ? `${Math.floor((usageMetrics.totalPlayTimeMinutes) / 60)}h ${(usageMetrics.totalPlayTimeMinutes) % 60}m`
                : 'N/A'}
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="font-semibold text-violet-900">Theme Performance Summary</h4>
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

        {/* Theme Search & Filter */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h4 className="font-semibold text-gray-900">Theme Word Search</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Period</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Start date"
                />
                <input 
                  type="date" 
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                  placeholder="End date"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Theme</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white text-gray-900">
                <option value="" className="text-gray-900">All Themes</option>
                <option value="food" className="text-gray-900">Food & Drinks (Monday)</option>
                <option value="nouns" className="text-gray-900">Common Nouns (Tuesday)</option>
                <option value="nature" className="text-gray-900">Nature (Wednesday)</option>
                <option value="verbs" className="text-gray-900">Verbs (Thursday)</option>
                <option value="adjectives" className="text-gray-900">Adjectives (Friday)</option>
                <option value="colors" className="text-gray-900">Colors (Saturday)</option>
                <option value="animals" className="text-gray-900">Animals (Sunday)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all duration-200 font-semibold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Theme Words
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
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

        {/* UTC Timezone Notice */}
        <div className="mb-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            {(() => {
              const offsetMin = new Date().getTimezoneOffset();
              const sign = offsetMin <= 0 ? '+' : '-';
              const abs = Math.abs(offsetMin);
              const hh = Math.floor(abs / 60).toString().padStart(2, '0');
              const mm = (abs % 60).toString().padStart(2, '0');
              const suffix = mm === '00' ? hh : `${hh}:${mm}`;
              return `Note: Time periods are calculated in UTC. Your local offset is UTC${sign}${suffix}.`;
            })()}
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
            return (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleTimePeriodClick('late-night')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <span className="text-xs text-indigo-600 font-semibold">LATE NIGHT</span>
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
            return (
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleTimePeriodClick('early-morning')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-amber-600 font-semibold">EARLY MORNING</span>
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
            return (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleTimePeriodClick('late-morning')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold">LATE MORNING</span>
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
            return (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleTimePeriodClick('afternoon')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 0 0 18 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-green-600 font-semibold">AFTERNOON</span>
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
            return (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                onClick={() => handleTimePeriodClick('evening')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">EVENING</span>
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
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(timeAnalytics?.summary as any)?.hasLimitedSessionData && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm text-amber-800 font-medium">Limited Historical Data</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Time period analysis is based on recent sessions only. Your lifetime total is {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(timeAnalytics?.summary as any)?.lifetimeGamesPlayed} games, 
                      but only {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(timeAnalytics?.summary as any)?.recentSessionsAnalyzed} recent sessions are available for time period analysis.
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

function Sparkline({ data, height = 240, color = '#4f46e5' }: { data: { date: Date; value: number }[]; height?: number; color?: string }) {
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
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5"/>
          </pattern>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        
        {/* Background grid */}
        <rect x={leftMargin} y={0} width={width - leftMargin - rightMargin} height={chartHeight} fill="url(#grid)" />
        
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

        {/* Hover value label as SVG (more reliable than HTML overlay) */}
        {hoveredPoint !== null && points[hoveredPoint] && (
          <g>
            {(() => {
              const p = points[hoveredPoint];
              const labelY = Math.max(16, p.y - 28);
              const title = p.data.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const valueLabel = `${p.data.value} words`;
              const textWidth = Math.max(title.length, valueLabel.length) * 7 + 20; // rough estimate
              const rectX = p.x - textWidth / 2;
              const rectY = labelY - 26;
              return (
                <g>
                  <rect x={rectX} y={rectY} rx="8" ry="8" width={textWidth} height={32} fill="#111827" opacity="0.9" />
                  <text x={p.x} y={rectY + 14} textAnchor="middle" fill="#93c5fd" fontSize="11" fontWeight="700">{title}</text>
                  <text x={p.x} y={rectY + 26} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700">{valueLabel}</text>
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
                  <rect x={rectX} y={rectY} rx="8" ry="8" width={approxWidth} height={padY * 2 + 8} fill="#111827" opacity="0.9" />
                  <text x={p.x} y={labelY} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700">{label}</text>
                </g>
              );
            })()}
          </g>
        )}
        
        {/* Date labels - Better spacing and larger font */}
        {dateLabels.map((d, i) => {
          const originalIndex = data.findIndex(item => item.date.getTime() === d.date.getTime());
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
                <line 
                  x1={leftMargin} 
                  y1={y} 
                  x2={width - rightMargin} 
                  y2={y} 
                  stroke="#e5e7eb" 
                  strokeWidth="1" 
                  strokeDasharray="2,2"
                />
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
