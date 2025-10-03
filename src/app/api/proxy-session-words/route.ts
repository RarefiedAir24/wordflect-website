import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

// Force Vercel rebuild - session words API call - v3 - AUTH FIX

export async function GET(request: NextRequest) {
  try {
    console.log('🟢 PROXY SESSION WORDS CALLED - v3 - NEW VERSION');
    
    // Log all incoming headers for debugging
    console.log('=== PROXY SESSION WORDS DEBUG ===');
    console.log('All incoming headers:', Object.fromEntries(request.headers.entries()));
    
    // Extract Authorization header specifically
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', authHeader);
    
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '';
    const timezone = searchParams.get('timezone') || '';
    const targetUrl = new URL(`${API_BASE_URL}/user/session-words`);
    if (range) targetUrl.searchParams.set('range', range);
    if (timezone) targetUrl.searchParams.set('timezone', timezone);

    console.log('🟢 Proxy session words - target URL:', targetUrl.toString());

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if it exists
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('Authorization header added to outgoing request');
    } else {
      console.log('No Authorization header found in incoming request');
    }

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers
    });
    
    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));

    console.log('🟢 Proxy session words - response status:', response.status);
    console.log('🟢 Proxy session words - response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('🟢 Response data:', data);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy session words error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
