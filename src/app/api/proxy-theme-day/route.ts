import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    
    // Build the target URL
    let targetUrl = `${API_BASE_URL}/user/theme/day`;
    if (date) {
      targetUrl += `?date=${encodeURIComponent(date)}`;
    }

    console.log('📤 Theme Day Proxy: Forwarding request to:', targetUrl);
    console.log('📤 Theme Day Proxy: Date parameter:', date);
    console.log('📤 Theme Day Proxy: Auth header present:', !!request.headers.get('authorization'));

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      }
    });

    console.log('📥 Theme Day Proxy: Response status:', response.status);
    console.log('📥 Theme Day Proxy: Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('📥 Theme Day Proxy: Error response:', errorText);
      return NextResponse.json({ 
        error: 'Backend request failed', 
        status: response.status, 
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log('📥 Theme Day Proxy: Success response data:', JSON.stringify(data, null, 2));
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('📥 Theme Day Proxy: Fetch error:', error);
    return NextResponse.json({ 
      error: 'Proxy request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
