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

    // Extract Authorization header explicitly
    const authHeader = request.headers.get('authorization');

    console.log('📤📤📤 Theme Day Proxy: Received request');
    console.log('📤📤📤 Theme Day Proxy: Full request URL:', request.url);
    console.log('📤📤📤 Theme Day Proxy: Search params:', Object.fromEntries(searchParams.entries()));
    console.log('📤📤📤 Theme Day Proxy: Date parameter extracted:', date);
    console.log('📤📤📤 Theme Day Proxy: Forwarding request to:', targetUrl);
    console.log('📤📤📤 Theme Day Proxy: Auth header present:', !!authHeader);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    if (authHeader) headers['Authorization'] = authHeader;

    // Add cache-busting query parameter to prevent API Gateway caching
    const cacheBuster = `&_t=${Date.now()}`;
    const finalUrl = targetUrl.includes('?') ? `${targetUrl}${cacheBuster}` : `${targetUrl}?${cacheBuster.substring(1)}`;
    
    console.log('📤📤📤 Theme Day Proxy: Final URL with cache buster:', finalUrl);
    
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers,
      cache: 'no-store'
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
      }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
    }
    
    const data = await response.json();
    console.log('📥📥📥 Theme Day Proxy: Backend response received');
    console.log('📥📥📥 Theme Day Proxy: Response date:', data.date);
    console.log('📥📥📥 Theme Day Proxy: Response theme name:', data.theme?.name);
    console.log('📥📥📥 Theme Day Proxy: Requested date was:', date);
    if (data.date !== date) {
      console.error('❌❌❌ PROXY DATE MISMATCH: Requested', date, 'but backend returned', data.date);
    }
    console.log('📥 Theme Day Proxy: Success response data:', JSON.stringify(data, null, 2));
    
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('📥 Theme Day Proxy: Fetch error:', error);
    return NextResponse.json({ 
      error: 'Proxy request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
