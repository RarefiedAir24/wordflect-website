import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    
    // Get auth header from request
    const authHeader = request.headers.get('authorization');
    
    // If no auth header, try to get it from cookies (like the web app does)
    let finalAuthHeader = authHeader;
    if (!finalAuthHeader) {
      const cookies = request.headers.get('cookie');
      if (cookies) {
        const jwtMatch = cookies.match(/jwt=([^;]+)/);
        if (jwtMatch) {
          finalAuthHeader = `Bearer ${jwtMatch[1]}`;
        }
      }
    }
    
    if (!finalAuthHeader) {
      return NextResponse.json({ 
        error: 'No authentication found. Please sign in first.',
        details: 'This endpoint requires authentication. Please sign in to the web app first, then visit this URL.'
      }, { status: 401 });
    }
    
    // Build the target URL
    let targetUrl = `${API_BASE_URL}/user/theme/day`;
    if (date) {
      targetUrl += `?date=${encodeURIComponent(date)}`;
    }

    console.log('🔍 Debug Theme Day: Checking backend for date:', date);
    console.log('🔍 Debug Theme Day: Target URL:', targetUrl);
    console.log('🔍 Debug Theme Day: Auth header present:', !!finalAuthHeader);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': finalAuthHeader
      }
    });

    console.log('🔍 Debug Theme Day: Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔍 Debug Theme Day: Error response:', errorText);
      return NextResponse.json({ 
        error: 'Backend request failed', 
        status: response.status, 
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log('🔍 Debug Theme Day: Success response data:', JSON.stringify(data, null, 2));
    
    // Return detailed information about the theme words
    return NextResponse.json({
      date: date,
      backendResponse: data,
      themeName: data?.theme?.name || 'Unknown',
      themeWords: data?.theme?.words || [],
      themeWordsCount: data?.theme?.words?.length || 0,
      themeWordsFound: data?.themeWordsFound || [],
      themeWordsFoundCount: data?.themeWordsFound?.length || 0,
      isSealIncluded: data?.theme?.words?.includes('SEAL') || false,
      isSealFound: data?.themeWordsFound?.includes('SEAL') || false,
      allWords: data?.theme?.words?.map((word: string) => word.toUpperCase()) || []
    }, { status: 200 });
  } catch (error) {
    console.error('🔍 Debug Theme Day: Fetch error:', error);
    return NextResponse.json({ 
      error: 'Debug request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
