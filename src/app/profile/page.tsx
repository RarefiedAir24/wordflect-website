"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService, UserProfile } from "@/services/api";

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
  const [refreshing, setRefreshing] = useState(false);

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
        if (typeof w === 'string') return { word: w, date: new Date() };
        const d = w.date ? new Date(w.date) : new Date();
        return { word: w.word, date: isNaN(d.getTime()) ? new Date() : d };
      })
      .filter((e) => !!e.word);

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
  
  // Calculate history metrics for the selected period - make it reactive to range changes
  const historyMetrics = React.useMemo(() => {
    // Always use the data that's being displayed in the chart
    // If historyDays exists (even if empty), use it; otherwise fall back to aggregated
    const chartData = historyDays !== null ? historyDays : (profile ? aggregated(profile).days : []);
    
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
  }, [historyDays, profile, aggregated]); // Add dependencies to make it reactive

  useEffect(() => {
    const load = async () => {
      try {
        if (!apiService.isAuthenticated()) return;
        
        // For custom range, we need to get all data and filter client-side
        // since the API doesn't support custom date ranges
        if (range === "custom" && customDateRange.start && customDateRange.end) {
          const res = await apiService.getUserHistory({ range: "all" });
          const allData = Array.isArray(res.days) ? res.days.map(d => ({
            date: new Date(d.date),
            value: typeof d.value === 'number' ? d.value : 0,
            avgLen: typeof d.avgLen === 'number' ? d.avgLen : undefined
          })) : [];
          
          // Filter data by custom date range
          const startDate = new Date(customDateRange.start + 'T00:00:00');
          const endDate = new Date(customDateRange.end + 'T23:59:59');
          
          const filteredData = allData.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= startDate && dataDate <= endDate;
          });
          
          // If no data found, fall back to aggregated data
          if (filteredData.length === 0) {
            setHistoryDays(null); // This will trigger the fallback to aggregated data
          } else {
            setHistoryDays(filteredData);
          }
        } else {
          // Since 7D works correctly with aggregated data, use the same approach for all ranges
          // This ensures consistency and avoids backend API issues
          setHistoryDays(null); // This will trigger the aggregated function to be used
        }
      } catch (error) {
        console.warn('Falling back to client aggregation for history:', error);
        setHistoryDays(null);
      }
    };
    load();
  }, [range, customDateRange]);


  const fetchProfile = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      }
      
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
          return foundDate.toDateString() === today.toDateString();
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
      if (showRefreshing) {
        setRefreshing(false);
      }
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
    const generateTimeAnalytics = () => {
      if (!profile || !profile.allFoundWords || !Array.isArray(profile.allFoundWords)) {
        setTimeAnalytics(null);
        return;
      }

      console.log('=== GENERATING TIME ANALYTICS FROM EXISTING DATA ===');
      console.log('User:', profile.email, profile.username);
      console.log('Total words found:', profile.allFoundWords.length);
      console.log('Sample words with dates:', profile.allFoundWords.slice(0, 5));
      
      // Group words by time periods based on when they were found
      const timePeriods: Record<string, { words: { word?: string; date?: string }[], games: number }> = {
        'early-morning': { words: [], games: 0 },
        'late-morning': { words: [], games: 0 },
        'afternoon': { words: [], games: 0 },
        'evening': { words: [], games: 0 }
      };

      // Analyze words found in the last 30 days for time patterns (including today)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of day

      let wordsWithDates = 0;
      let wordsToday = 0;

      profile.allFoundWords.forEach((wordEntry) => {
        // Handle both string and object formats
        const word = typeof wordEntry === 'string' ? { word: wordEntry, date: undefined } : wordEntry;
        if (word.date) {
          wordsWithDates++;
          const foundDate = new Date(word.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Check if word was found today (UTC timezone)
          const todayUTC = new Date(today.toISOString().split('T')[0] + 'T00:00:00.000Z');
          const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);
          if (foundDate >= todayUTC && foundDate < tomorrowUTC) {
            wordsToday++;
          }
          
          if (foundDate >= thirtyDaysAgo) {
            const hour = foundDate.getHours();
            
            if (hour >= 5 && hour < 10) {
              timePeriods['early-morning'].words.push(word);
            } else if (hour >= 10 && hour < 15) {
              timePeriods['late-morning'].words.push(word);
            } else if (hour >= 15 && hour < 20) {
              timePeriods['afternoon'].words.push(word);
            } else if (hour >= 20 || hour < 5) {
              timePeriods['evening'].words.push(word);
            }
          }
        }
      });

      console.log('Words with dates:', wordsWithDates);
      console.log('Words found today:', wordsToday);

      // Generate analytics data
      const analytics = {
        timePeriods: Object.entries(timePeriods).map(([period, data]) => ({
          period,
          wordsFound: data.words.length,
          gamesPlayed: Math.ceil(data.words.length / 15), // Estimate games based on words
          avgPerGame: data.words.length > 0 ? Math.round(data.words.length / Math.max(1, Math.ceil(data.words.length / 15))) : 0,
          performance: Math.min(100, Math.round((data.words.length / 50) * 100)) // Performance score
        }))
      };

      console.log('Generated time analytics:', analytics);
      setTimeAnalytics(analytics);
    };

    if (profile) {
      generateTimeAnalytics();
    }
  }, [profile]);

  // Generate theme analytics from existing data
  useEffect(() => {
    const generateThemeAnalytics = async () => {
      if (!profile || !profile.allFoundWords || !Array.isArray(profile.allFoundWords)) {
        setThemeAnalytics(null);
        return;
      }

      console.log('=== GENERATING THEME ANALYTICS FROM EXISTING DATA ===');
      console.log('User:', profile.email, profile.username);
      console.log('Total words found:', profile.allFoundWords.length);
      console.log('Sample words with dates:', profile.allFoundWords.slice(0, 5));
      const now = new Date();
      console.log('Today is:', now.toDateString());
      console.log('Today day of week (local):', now.getDay()); // 0 = Sunday, 1 = Monday, etc.
      console.log('Today day of week (UTC):', now.getUTCDay()); // 0 = Sunday, 1 = Monday, etc.
      console.log('Current timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
      console.log('Current time (local):', now.toString());
      console.log('Current time (UTC):', now.toISOString());
      console.log('Local date string:', now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'));
      console.log('UTC date string:', now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + String(now.getUTCDate()).padStart(2, '0'));

      // Try to get the actual theme words from the backend API
      // eslint-disable-next-line prefer-const
      let themeWords = {
        monday: ['PIZZA', 'BURGER', 'SALAD', 'SOUP', 'CAKE', 'BREAD', 'RICE', 'PASTA', 'SANDWICH', 'COFFEE', 'TEA', 'JUICE', 'WATER', 'MILK', 'BEER', 'WINE', 'CHEESE', 'BUTTER', 'SUGAR', 'SALT'],
        tuesday: ['HOUSE', 'CAR', 'TREE', 'BOOK', 'CHAIR', 'TABLE', 'DOOR', 'WINDOW', 'PHONE', 'CLOCK', 'LAMP', 'BED', 'SOFA', 'DESK', 'MIRROR', 'PICTURE', 'FLOWER', 'GARDEN', 'STREET', 'BRIDGE'],
        wednesday: ['RUN', 'WALK', 'JUMP', 'SWIM', 'DANCE', 'SING', 'READ', 'WRITE', 'DRAW', 'PAINT', 'COOK', 'BAKE', 'CLEAN', 'WASH', 'DRIVE', 'FLY', 'CLIMB', 'SKATE', 'SKI', 'RIDE'],
        thursday: ['DUCK', 'GOOSE', 'CRAB', 'HORSE', 'SHEEP', 'COW', 'PIG', 'CHICKEN', 'TURKEY', 'LAMB', 'GOAT', 'DEER', 'ELK', 'MOOSE', 'BUFFALO', 'CAMEL', 'LLAMA', 'ALPACA', 'YAK', 'BISON'],
        friday: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BROWN', 'BLACK', 'WHITE', 'GRAY', 'GOLD', 'SILVER', 'CYAN', 'MAGENTA', 'LIME', 'NAVY', 'TEAL', 'MAROON', 'OLIVE'],
        saturday: ['TREE', 'FLOWER', 'GRASS', 'MOUNTAIN', 'RIVER', 'OCEAN', 'SUN', 'MOON', 'STAR', 'CLOUD', 'RAIN', 'SNOW', 'WIND', 'FIRE', 'EARTH', 'SKY', 'SEA', 'LAKE', 'FOREST', 'DESERT'],
        sunday: ['PHONE', 'COMPUTER', 'INTERNET', 'EMAIL', 'WEBSITE', 'APP', 'GAME', 'MOVIE', 'MUSIC', 'VIDEO', 'CAMERA', 'TV', 'RADIO', 'SPEAKER', 'HEADPHONE', 'KEYBOARD', 'MOUSE', 'SCREEN', 'BATTERY', 'CHARGER']
      };

      // Get theme words from the backend for the current week's theme schedule
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      // Get today's date and calculate the current week's theme schedule
      const today = new Date();
      const todayDayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate the start of the current week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setUTCDate(today.getUTCDate() - todayDayOfWeek);
      const weekKey = startOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`Generating theme analytics for week starting: ${weekKey}`);
      
      // Check if we need to regenerate theme analytics for a new week
      const lastWeekKey = localStorage.getItem('lastThemeAnalyticsWeek');
      if (lastWeekKey !== weekKey) {
        console.log(`New week detected! Previous week: ${lastWeekKey}, Current week: ${weekKey}`);
        localStorage.setItem('lastThemeAnalyticsWeek', weekKey);
      }
      
      for (let i = 0; i < 7; i++) {
        try {
          // Calculate the date for each day of the current week
          const date = new Date();
          const daysFromToday = i - todayDayOfWeek; // Adjust to get the correct day of the week
          date.setUTCDate(date.getUTCDate() + daysFromToday);
          
          const dateString = date.getUTCFullYear() + '-' + 
            String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + 
            String(date.getUTCDate()).padStart(2, '0'); // YYYY-MM-DD format in UTC
          
          const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
          const dayName = dayNames[dayOfWeek];
          
          console.log(`Fetching theme words for ${dayName} (${dateString}) - UTC date`);
          
          const themeDayResponse = await apiService.getThemeDayStatistics(dateString);
          
          // Debug: Log the full response structure
          console.log(`Full API response for ${dayName}:`, JSON.stringify(themeDayResponse, null, 2));
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (themeDayResponse && (themeDayResponse as any).theme && (themeDayResponse as any).theme.words) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (Array.isArray((themeDayResponse as any).theme.words)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const backendThemeWords = (themeDayResponse as any).theme.words.map((word: string) => word.toUpperCase());
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const backendThemeName = (themeDayResponse as any).theme.name;
              
              console.log(`Backend ${dayName} theme: ${backendThemeName}`);
              console.log(`Backend ${dayName} words:`, backendThemeWords);
              
              // Use backend theme data as the source of truth (mobile app team has corrected the themes)
              themeWords[dayName as keyof typeof themeWords] = backendThemeWords;
              console.log(`✅ Using backend ${dayName} theme words: ${backendThemeName}`);
              
              // Store the full response for this day to use in theme analytics
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (themeWords as any)[`${dayName}_response`] = themeDayResponse;
            }
          }
        } catch (error) {
          console.log(`Could not fetch theme words for day ${i} (${dayNames[new Date().getDay() - i] || 'unknown'}), using defaults. Error:`, error);
          // Continue with hardcoded theme words - this is expected if API is down
        }
      }

      console.log('Final theme words being used:', themeWords);
      console.log('Thursday theme words specifically:', themeWords.thursday);
      console.log('Thursday theme words count:', themeWords.thursday.length);

      // Group words by day of week and count theme matches
      // IMPORTANT: Use the correct theme words for each day
      const themeData: Record<string, { words: { word?: string; date?: string }[], themeWords: string[] }> = {
        monday: { words: [], themeWords: themeWords.monday },
        tuesday: { words: [], themeWords: themeWords.tuesday },
        wednesday: { words: [], themeWords: themeWords.wednesday },
        thursday: { words: [], themeWords: themeWords.thursday },
        friday: { words: [], themeWords: themeWords.friday },
        saturday: { words: [], themeWords: themeWords.saturday },
        sunday: { words: [], themeWords: themeWords.sunday }
      };

      // Analyze words found in the last 30 days (including today)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of day

      let themeWordsWithDates = 0;
      let themeWordsToday = 0;

      profile.allFoundWords.forEach((wordEntry) => {
        // Handle both string and object formats
        const word = typeof wordEntry === 'string' ? { word: wordEntry, date: undefined } : wordEntry;
        if (word.date) {
          themeWordsWithDates++;
          const foundDate = new Date(word.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Check if word was found today (UTC timezone)
          const todayUTC = new Date(today.toISOString().split('T')[0] + 'T00:00:00.000Z');
          const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);
          if (foundDate >= todayUTC && foundDate < tomorrowUTC) {
            themeWordsToday++;
          }
          
          if (foundDate >= thirtyDaysAgo) {
            const dayOfWeek = foundDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[dayOfWeek];
            
            console.log(`Word "${word.word}" found on ${foundDate.toDateString()} (${dayName})`);
            
            if (themeData[dayName as keyof typeof themeData]) {
              themeData[dayName as keyof typeof themeData].words.push(word);
            }
          }
        }
      });

      console.log('Theme words with dates:', themeWordsWithDates);
      console.log('Theme words found today:', themeWordsToday);

      // Generate analytics data
      const analytics = {
        themes: Object.entries(themeData).map(([day, data]) => {
          // Get the backend response for this day to use the actual themeWordsFound data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const backendResponse = (themeWords as any)[`${day}_response`];
          
          let foundThemeWords: string[] = [];
          const allThemeWords: string[] = data.themeWords;
          
          if (backendResponse && backendResponse.themeWordsFound && backendResponse.themeWordsFound.length > 0) {
            // Use the backend's themeWordsFound data (most accurate)
            foundThemeWords = backendResponse.themeWordsFound.map((word: string) => word.toUpperCase());
            console.log(`${day}: Using backend themeWordsFound:`, foundThemeWords);
          } else {
            // Backend themeWordsFound is empty, use manual matching
            console.log(`${day}: Backend themeWordsFound is empty, using manual matching`);
            
            // Use the backend's theme words for this specific day
            const dayThemeWords = backendResponse?.theme?.words || [];
            console.log(`${day}: Using theme words:`, dayThemeWords);
            
            // Find words that match the theme words for this day
            const foundThemeWordsObjects = data.words.filter((word: { word?: string; date?: string }) => 
              word.word && dayThemeWords.includes(word.word.toUpperCase())
            );
            foundThemeWords = foundThemeWordsObjects.map((word: { word?: string; date?: string }) => word.word?.toUpperCase()).filter(Boolean) as string[];
            console.log(`${day}: Manual matching found:`, foundThemeWords);
          }
          
          console.log(`${day}: Found ${foundThemeWords.length} theme words out of ${data.words.length} total words`);
          console.log(`${day}: Theme words found:`, foundThemeWords);
          
          return {
            day,
            wordsFound: foundThemeWords.length,
            totalWords: allThemeWords.length,
            words: foundThemeWords.slice(0, 20), // Limit to 20 words
            allThemeWords: allThemeWords, // All theme words for this day
            foundWords: foundThemeWords // Only found words
          };
        })
      };

      console.log('Generated theme analytics:', analytics);
      setThemeAnalytics(analytics);
    };

    if (profile) {
      generateThemeAnalytics();
    }
  }, [profile]);

  const handleSignOut = async () => {
    await apiService.signOut();
    router.push("/");
  };

  // Helper function to get time period data
  const getTimePeriodData = (period: string) => {
    console.log('getTimePeriodData called for period:', period);
    console.log('timeAnalytics:', timeAnalytics);
    console.log('timeAnalytics.timePeriods:', timeAnalytics?.timePeriods);
    
    if (!timeAnalytics || !timeAnalytics.timePeriods || !Array.isArray(timeAnalytics.timePeriods)) {
      console.log('No time analytics data available');
      return null;
    }

    const periodData = timeAnalytics.timePeriods.find((p: Record<string, unknown>) => p.period === period);
    if (periodData) {
      const wordsFound = (periodData.wordsFound as number) || 0;
      const gamesPlayed = (periodData.gamesPlayed as number) || 0;
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
    console.log('themeAnalytics.themes:', themeAnalytics?.themes);
    
    if (!themeAnalytics || !themeAnalytics.themes || !Array.isArray(themeAnalytics.themes)) {
      console.log('No theme analytics data available');
      return null;
    }

    const themeData = themeAnalytics.themes.find((t: Record<string, unknown>) => t.day === day);
    if (themeData) {
      const wordsFound = (themeData.wordsFound as number) || 0;
      const totalWords = (themeData.totalWords as number) || 20;
      const words = (themeData.words as string[]) || [];
      const completionPercent = totalWords > 0 ? Math.round((wordsFound / totalWords) * 100) : 0;

      return {
        wordsFound,
        totalWords,
        completionPercent,
        words
      };
    }

    return {
      wordsFound: 0,
      totalWords: 20,
      completionPercent: 0,
      words: []
    };
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
      wednesday: 'Verbs',
      thursday: 'Adjectives',
      friday: 'Animals',
      saturday: 'Nature',
      sunday: 'Technology'
    };
    return fallbackNames[day as keyof typeof fallbackNames] || day;
  };

  const getThemePerformanceSummary = () => {
    if (!themeAnalytics || !themeAnalytics.themes || !Array.isArray(themeAnalytics.themes)) {
      return {
        bestTheme: { name: 'No data', day: '', percentage: 0 },
        mostConsistent: { name: 'No data', day: '', percentage: 0 },
        totalThemeWords: 0
      };
    }

    const themes = themeAnalytics.themes as Record<string, unknown>[];

    let bestTheme = { name: 'No data', day: '', percentage: 0 };
    let mostConsistent = { name: 'No data', day: '', percentage: 0 };
    let totalThemeWords = 0;

    themes.forEach((theme: Record<string, unknown>) => {
      const day = theme.day as string;
      const wordsFound = (theme.wordsFound as number) || 0;
      const totalWords = (theme.totalWords as number) || 0;
      const completionPercent = totalWords > 0 ? Math.round((wordsFound / totalWords) * 100) : 0;
      
      totalThemeWords += wordsFound;

      // Find best performing theme (highest completion percentage)
      if (completionPercent > bestTheme.percentage) {
        bestTheme = {
          name: getThemeName(day),
          day: day.charAt(0).toUpperCase() + day.slice(1),
          percentage: completionPercent
        };
      }

      // Find most consistent theme (highest number of words found)
      if (wordsFound > (mostConsistent.percentage || 0)) {
        mostConsistent = {
          name: getThemeName(day),
          day: day.charAt(0).toUpperCase() + day.slice(1),
          percentage: wordsFound
        };
      }
    });

    return { bestTheme, mostConsistent, totalThemeWords };
  };

  // Handle theme day click
  const handleThemeDayClick = async (day: string) => {
    setSelectedThemeDay(day);
    setIsThemeModalOpen(true);
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
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mb-4 md:mb-0">
          <button
                  onClick={async () => {
                    try {
                      console.log('🔍 DEBUG: Checking backend data directly...');
                      const response = await fetch('/api/debug-profile', {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                      });
                      const data = await response.json();
                      console.log('🔍 DEBUG: Backend data result:', data);
                      
                      // Show specific info about target words
                      if (data.backendData && data.backendData.targetWordsCheck) {
                        const summary = data.backendData.targetWordsCheck.map((w: { word: string; found: boolean }) => 
                          `${w.word}: ${w.found ? '✅' : '❌'}`
                        ).join(', ');
                        alert(`Backend Check Results:\n${summary}\n\nFull data logged to console.`);
                      } else {
                        alert('Backend debug data logged to console. Check browser console for details.');
                      }
                    } catch (error) {
                      console.error('🔍 DEBUG: Error:', error);
                      alert('Debug failed. Check console for details.');
                    }
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Debug Backend
          </button>
            <button
                onClick={() => fetchProfile(true)}
                disabled={refreshing}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                {refreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                  </>
                )}
          </button>
        </div>
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
                        const today = new Date();
                        
                        // Validate dates
                        if (startDate > endDate) {
                          alert('Start date must be before end date');
                          return;
                        }
                        if (endDate > today) {
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
          <Sparkline data={(historyDays && historyDays.length ? historyDays : aggregated(profile).days)} height={120} color="#4f46e5" />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MiniStat title="Words (found)" value={historyMetrics.totalWords.toLocaleString()} />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              {profile.totalPlayTimeMinutes 
                ? `${Math.floor(profile.totalPlayTimeMinutes / 60)}h ${profile.totalPlayTimeMinutes % 60}m`
                : 'N/A'
              }
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
              {profile.daysLoggedIn || 'N/A'}
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
              {profile.currentStreakDays || 'N/A'}
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
              {profile.longestStreakDays || 'N/A'}
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
                <strong>Avg. Session:</strong> {profile.totalPlayTimeMinutes && profile.gamesPlayed 
                  ? `${Math.round(profile.totalPlayTimeMinutes / profile.gamesPlayed)}m`
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700">
                <strong>Last Login:</strong> {profile.lastLoginAt 
                  ? new Date(profile.lastLoginAt).toLocaleDateString()
                  : 'N/A'
                }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Monday - Food & Drinks */}
          {(() => {
            const themeData = getThemeData('monday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🍕</span>
            </div>
                    <span className="text-xs text-gray-500 font-semibold">MONDAY</span>
          </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('monday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏠</span>
            </div>
                    <span className="text-xs text-gray-500 font-semibold">TUESDAY</span>
          </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('tuesday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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

          {/* Wednesday - Verbs */}
          {(() => {
            const themeData = getThemeData('wednesday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏃</span>
            </div>
                    <span className="text-xs text-gray-500 font-semibold">WEDNESDAY</span>
          </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('wednesday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">📝</span>
            </div>
                    <span className="text-xs text-gray-500 font-semibold">THURSDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('thursday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🐕</span>
            </div>
                    <span className="text-xs text-gray-500 font-semibold">FRIDAY</span>
          </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('friday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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

          {/* Saturday - Nature */}
          {(() => {
            const themeData = getThemeData('saturday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🌳</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">SATURDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('saturday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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

          {/* Sunday - Technology */}
          {(() => {
            const themeData = getThemeData('sunday');
            if (!themeData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">📱</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">SUNDAY</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">{getThemeName('sunday')}</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
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
                <option value="verbs" className="text-gray-900">Verbs (Wednesday)</option>
                <option value="animals" className="text-gray-900">Animals (Thursday)</option>
                <option value="adjectives" className="text-gray-900">Adjectives (Friday)</option>
                <option value="nature" className="text-gray-900">Nature (Saturday)</option>
                <option value="technology" className="text-gray-900">Technology (Sunday)</option>
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
        

        {/* Time Period Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Early Morning (5AM - 10AM) */}
          {(() => {
            const periodData = getTimePeriodData('early-morning');
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">EARLY MORNING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">5:00 AM - 10:00 AM</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            return (
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-amber-600 font-semibold">EARLY MORNING</span>
                </div>
                <p className="text-lg font-bold text-amber-900">5:00 AM - 10:00 AM</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Words Found:</span>
                    <span className="font-semibold text-amber-900">{periodData.wordsFound}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Games Played:</span>
                    <span className="font-semibold text-amber-900">{periodData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Avg. per Game:</span>
                    <span className="font-semibold text-amber-900">{periodData.avgPerGame}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-amber-200 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${periodData.performance}%` }}></div>
                  </div>
                  <span className="text-xs text-amber-600 font-semibold">{periodData.performance}%</span>
                </div>
                <p className="text-xs text-amber-700 mt-2">{periodData.status}</p>
              </div>
            );
          })()}

          {/* Late Morning (10AM - 3PM) */}
          {(() => {
            const periodData = getTimePeriodData('late-morning');
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">LATE MORNING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">10:00 AM - 3:00 PM</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            return (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold">LATE MORNING</span>
                </div>
                <p className="text-lg font-bold text-blue-900">10:00 AM - 3:00 PM</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Words Found:</span>
                    <span className="font-semibold text-blue-900">{periodData.wordsFound}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Games Played:</span>
                    <span className="font-semibold text-blue-900">{periodData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Avg. per Game:</span>
                    <span className="font-semibold text-blue-900">{periodData.avgPerGame}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${periodData.performance}%` }}></div>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold">{periodData.performance}%</span>
                </div>
                <p className="text-xs text-blue-700 mt-2">{periodData.status}</p>
              </div>
            );
          })()}

          {/* Afternoon (3PM - 8PM) */}
          {(() => {
            const periodData = getTimePeriodData('afternoon');
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">AFTERNOON</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">3:00 PM - 8:00 PM</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            return (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-green-600 font-semibold">AFTERNOON</span>
                </div>
                <p className="text-lg font-bold text-green-900">3:00 PM - 8:00 PM</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Words Found:</span>
                    <span className="font-semibold text-green-900">{periodData.wordsFound}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Games Played:</span>
                    <span className="font-semibold text-green-900">{periodData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Avg. per Game:</span>
                    <span className="font-semibold text-green-900">{periodData.avgPerGame}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${periodData.performance}%` }}></div>
                  </div>
                  <span className="text-xs text-green-600 font-semibold">{periodData.performance}%</span>
                </div>
                <p className="text-xs text-green-700 mt-2">{periodData.status}</p>
              </div>
            );
          })()}

          {/* Evening (8PM - 12AM) */}
          {(() => {
            const periodData = getTimePeriodData('evening');
            if (!periodData) {
              return (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">EVENING</span>
                  </div>
                  <p className="text-lg font-bold text-gray-500">8:00 PM - 12:00 AM</p>
                  <div className="mt-3 text-center text-gray-500 text-sm">No data available</div>
                </div>
              );
            }
            return (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">EVENING</span>
                </div>
                <p className="text-lg font-bold text-purple-900">8:00 PM - 12:00 AM</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Words Found:</span>
                    <span className="font-semibold text-purple-900">{periodData.wordsFound}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Games Played:</span>
                    <span className="font-semibold text-purple-900">{periodData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Avg. per Game:</span>
                    <span className="font-semibold text-purple-900">{periodData.avgPerGame || '-'}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${periodData.performance}%` }}></div>
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">{periodData.performance}%</span>
                </div>
                <p className="text-xs text-purple-700 mt-2">{periodData.status}</p>
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
                  const periods = ['early-morning', 'late-morning', 'afternoon', 'evening'];
                  const periodNames = ['5:00 AM - 10:00 AM', '10:00 AM - 3:00 PM', '3:00 PM - 8:00 PM', '8:00 PM - 12:00 AM'];
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
                  const periods = ['early-morning', 'late-morning', 'afternoon', 'evening'];
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
                  const periods = ['early-morning', 'late-morning', 'afternoon', 'evening'];
                  const periodNames = ['morning', 'late morning', 'afternoon', 'evening'];
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
                { key: 'early-morning', label: '5AM-10AM', color: 'amber' },
                { key: 'late-morning', label: '10AM-3PM', color: 'blue' },
                { key: 'afternoon', label: '3PM-8PM', color: 'green' },
                { key: 'evening', label: '8PM-12AM', color: 'purple' }
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
                const periods = ['early-morning', 'late-morning', 'afternoon', 'evening'];
                const total = periods.reduce((sum, period) => {
                  const data = getTimePeriodData(period);
                  return sum + (data ? data.wordsFound : 0);
                }, 0);
                return `${total} across all time periods`;
              })()}
            </p>
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

      {/* Theme Words Modal */}
      {isThemeModalOpen && selectedThemeDay && (
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
                const themeData = getThemeData(selectedThemeDay);
                if (!themeData) {
                  return (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No theme data available</h3>
                      <p className="text-gray-600">Theme analytics are being generated...</p>
                    </div>
                  );
                }

                // Get all theme words for this day from the themeAnalytics
                const themes = themeAnalytics?.themes as Record<string, unknown>[] | undefined;
                const dayThemeWords = themes?.find((t: Record<string, unknown>) => t.day === selectedThemeDay);
                const allThemeWords = dayThemeWords?.allThemeWords as string[] || [];
                const foundWords = dayThemeWords?.foundWords as string[] || [];

                if (allThemeWords.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No theme words available</h3>
                      <p className="text-gray-600">Theme words for {selectedThemeDay} are being loaded...</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    {/* Progress Counter */}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {foundWords.length}/{allThemeWords.length}
                      </div>
                      <div className="text-sm text-gray-600">words found</div>
                    </div>

                    {/* Theme Words Grid */}
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {allThemeWords.map((word: string, index: number) => {
                        const isFound = foundWords.includes(word.toUpperCase());
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

function Sparkline({ data, height = 160, color = '#4f46e5' }: { data: { date: Date; value: number }[]; height?: number; color?: string }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  const chartHeight = height - 80; // Much more space for labels
  const leftMargin = 100; // Balanced space for Y-axis labels
  const rightMargin = 50;
  const topMargin = 30;
  const bottomMargin = 50;
  const width = Math.min(800, Math.max(400, data.length * 8) + leftMargin + rightMargin); // Responsive width with max limit
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
  
  const handlePointHover = (index: number, event: React.MouseEvent) => {
    setHoveredPoint(index);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 10
    });
  };
  
  const handlePointLeave = () => {
    setHoveredPoint(null);
    setTooltipPosition(null);
  };
  
  return (
    <div className="w-full bg-white rounded-lg p-4 border border-gray-200">
      <div className="w-full overflow-x-auto">
        <svg 
          width={width} 
          height={height} 
          className="block cursor-pointer"
          onMouseLeave={handlePointLeave}
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
              onMouseEnter={(e) => handlePointHover(i, e)}
              onMouseMove={(e) => handlePointHover(i, e)}
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
      
      {/* Interactive Tooltip - Enhanced styling */}
      {hoveredPoint !== null && tooltipPosition && (
        <div 
          className="absolute bg-gray-900 text-white text-sm rounded-xl px-4 py-3 shadow-2xl pointer-events-none z-10 border border-gray-700"
          style={{
            left: tooltipPosition.x - 60,
            top: tooltipPosition.y - 50,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-bold text-base">
            {points[hoveredPoint].data.date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          <div className="text-blue-300 font-semibold text-lg">
            {points[hoveredPoint].data.value} words found
          </div>
        </div>
      )}
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
