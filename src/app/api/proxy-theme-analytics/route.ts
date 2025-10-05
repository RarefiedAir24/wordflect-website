import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    // Log all incoming headers for debugging
    console.log('=== PROXY THEME ANALYTICS DEBUG ===');
    console.log('All incoming headers:', Object.fromEntries(request.headers.entries()));
    
    // Extract Authorization header specifically
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', authHeader ? `present (len=${authHeader.length})` : 'missing');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    // Only add Authorization header if it exists
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('Authorization header added to outgoing request');
    } else {
      console.log('No Authorization header found in incoming request');
    }
    
    const targetUrl = `${API_BASE_URL}/user/theme/analytics`;
    console.log('Outgoing headers:', headers);
    console.log('Target URL:', targetUrl);
    console.log('==========================================');
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error body:', errorText);
      return NextResponse.json({ error: 'Backend request failed', status: response.status, details: errorText }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const data = await response.json();
    console.log('Backend response data:', data);
    
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Proxy theme analytics error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
