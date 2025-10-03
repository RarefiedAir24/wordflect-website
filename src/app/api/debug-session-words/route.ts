import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Checking session words data directly');
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    console.log('🔍 DEBUG: Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return NextResponse.json({ 
        error: 'No authentication found. Please sign in first.',
        details: 'This endpoint requires authentication. Please sign in to the web app first, then visit this URL.'
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';
    
    const response = await fetch(`${API_BASE_URL}/user/session-words?range=${range}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
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
    console.log('🔍 DEBUG: Session words data received');
    console.log('🔍 DEBUG: Days count:', data.days?.length || 0);
    console.log('🔍 DEBUG: Sample data:', JSON.stringify(data, null, 2));
    
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
    console.error('🔍 DEBUG: Error:', error);
    return NextResponse.json({ 
      error: 'Debug request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
