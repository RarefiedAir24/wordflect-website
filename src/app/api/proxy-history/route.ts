import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

// Force Vercel rebuild - this is a new proxy route for history - AUTH FIX v3 - COMPLETE

export async function GET(request: NextRequest) {
  try {
    console.log('🟢 Force Vercel rebuild - history API call');
    
    // Log all incoming headers for debugging
    console.log('=== PROXY HISTORY DEBUG ===');
    console.log('All incoming headers:', Object.fromEntries(request.headers.entries()));
    
    // Extract Authorization header specifically
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', authHeader);
    
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '';
    const targetUrl = new URL(`${API_BASE_URL}/user/history`);
    if (range) targetUrl.searchParams.set('range', range);

    console.log('🟢 Proxy history - target URL:', targetUrl.toString());

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

    console.log('🟢 Proxy history - response status:', response.status);
    console.log('🟢 Proxy history - response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('🟢 Proxy history - response data:', data);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy history error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}


