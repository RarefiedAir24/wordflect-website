import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 TEST: Direct session words API call');
    
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    console.log('🔍 TEST: Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return NextResponse.json({ 
        error: 'No authentication found. Please sign in first.',
        details: 'This endpoint requires authentication. Please sign in to the web app first, then visit this URL.'
      }, { status: 401 });
    }
    
    const response = await fetch(`${API_BASE_URL}/user/session-words?range=${range}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });

    console.log('🔍 TEST: Backend response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔍 TEST: Backend error response:', errorText);
      return NextResponse.json({ 
        error: 'Backend request failed', 
        status: response.status,
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log('🔍 TEST: Session words data received');
    console.log('🔍 TEST: Days count:', data.days?.length || 0);
    console.log('🔍 TEST: Sample data:', JSON.stringify(data, null, 2));
    
    return NextResponse.json({
      success: true,
      data: data,
      debug: {
        daysCount: data.days?.length || 0,
        range: range,
        hasData: (data.days?.length || 0) > 0
      }
    });
  } catch (error) {
    console.error('🔍 TEST: Error:', error);
    return NextResponse.json({ 
      error: 'Test request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
