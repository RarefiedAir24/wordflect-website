import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('🟢 NEW PROXY SESSION WORDS CALLED');
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Auth header:', authHeader ? 'present' : 'missing');
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';
    const timezone = searchParams.get('timezone') || '';
    
    // Build target URL
    const targetUrl = new URL(`${API_BASE_URL}/user/session-words`);
    targetUrl.searchParams.set('range', range);
    if (timezone) targetUrl.searchParams.set('timezone', timezone);
    
    console.log('Target URL:', targetUrl.toString());
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    console.log('Outgoing headers:', headers);
    
    // Make the request
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers
    });
    
    console.log('Backend response status:', response.status);
    
    const data = await response.json();
    console.log('Backend response data:', data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('New proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
