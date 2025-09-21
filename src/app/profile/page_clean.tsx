  // Fetch theme analytics from backend API
  useEffect(() => {
    const fetchThemeAnalytics = async () => {
      if (!profile) {
        setThemeAnalytics(null);
        return;
      }

      console.log('🎯 Fetching theme analytics from backend API...');
      
      try {
        const response = await apiService.getThemeAnalytics();
        console.log('✅ Backend theme analytics response:', response);
        
        if (response && (response as Record<string, unknown>).analytics) {
          const analytics = (response as Record<string, unknown>).analytics as Record<string, unknown>;
          console.log('📊 Theme analytics data:', analytics);
          setThemeAnalytics(analytics);
        } else {
          console.warn('⚠️ No analytics data in backend response');
          setThemeAnalytics(null);
        }
      } catch (error) {
        console.error('❌ Error fetching theme analytics from backend:', error);
        setThemeAnalytics(null);
      }
    };

    if (profile) {
      fetchThemeAnalytics();
    }
  }, [profile]);
