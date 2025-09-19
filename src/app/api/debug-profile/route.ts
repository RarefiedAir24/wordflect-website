import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Checking backend profile data directly');
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    console.log('🔍 DEBUG: Auth header present:', !!authHeader);
    
    // If no auth header, try to get it from cookies (like the web app does)
    let finalAuthHeader = authHeader;
    if (!finalAuthHeader) {
      const cookies = request.headers.get('cookie');
      console.log('🔍 DEBUG: Cookies present:', !!cookies);
      
      // Look for JWT token in cookies
      if (cookies) {
        const jwtMatch = cookies.match(/jwt=([^;]+)/);
        if (jwtMatch) {
          finalAuthHeader = `Bearer ${jwtMatch[1]}`;
          console.log('🔍 DEBUG: Found JWT in cookies');
        }
      }
    }
    
    if (!finalAuthHeader) {
      return NextResponse.json({ 
        error: 'No authentication found. Please sign in first.',
        details: 'This endpoint requires authentication. Please sign in to the web app first, then visit this URL.'
      }, { status: 401 });
    }
    
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': finalAuthHeader
      }
    });

    console.log('🔍 DEBUG: Backend response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔍 DEBUG: Backend error response:', errorText);
      return NextResponse.json({ 
        error: 'Backend request failed', 
        status: response.status,
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log('🔍 DEBUG: Backend profile data received');
    console.log('🔍 DEBUG: Total words in backend:', data.allFoundWords?.length || 0);
    
    // Check for today's words specifically
    const today = new Date();
    const todayString = today.toDateString();
    console.log('🔍 DEBUG: Today string:', todayString);
    
    const todayWords = data.allFoundWords?.filter((w: string | { word: string; date?: string }) => {
      const date = typeof w === 'string' ? undefined : w.date;
      if (date) {
        const foundDate = new Date(date);
        return foundDate.toDateString() === todayString;
      }
      return false;
    }) || [];
    
    console.log('🔍 DEBUG: Words found today in backend:', todayWords.length);
    console.log('🔍 DEBUG: Today\'s words:', todayWords.map((w: string | { word: string; date?: string }) => {
      const word = typeof w === 'string' ? w : w.word;
      const date = typeof w === 'string' ? undefined : w.date;
      return { word, date };
    }));
    
    // Check for specific target words
    const targetWords = ['DUCK', 'GOOSE', 'CRAB', 'HORSE', 'SHEEP'];
    const wordCheck = targetWords.map(targetWord => {
      const found = data.allFoundWords?.some((w: string | { word: string; date?: string }) => {
        const word = typeof w === 'string' ? w : w.word;
        return word && word.toUpperCase() === targetWord;
      }) || false;
      return { word: targetWord, found };
    });
    
    console.log('🔍 DEBUG: Target words check:', wordCheck);
    
    return NextResponse.json({
      success: true,
      backendData: {
        totalWords: data.allFoundWords?.length || 0,
        todayWords: todayWords.length,
        todayWordsList: todayWords.map((w: string | { word: string; date?: string }) => {
          const word = typeof w === 'string' ? w : w.word;
          const date = typeof w === 'string' ? undefined : w.date;
          return { word, date };
        }),
        targetWordsCheck: wordCheck,
        profileData: {
          email: data.email,
          username: data.username,
          points: data.points
        }
      }
    });
    
  } catch (error) {
    console.error('🔍 DEBUG: Error:', error);
    return NextResponse.json({ 
      error: 'Debug request failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
