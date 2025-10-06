import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

// Ensure Node.js runtime and disable edge caching for auth header forwarding
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Log all incoming headers for debugging
    console.log('=== PROXY STATISTICS DETAILED DEBUG ===');
    console.log('All incoming headers:', Object.fromEntries(request.headers.entries()));
    
    // Extract Authorization header specifically
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', authHeader);
    
    // Build pass-through headers and force no-store
    const headers: Record<string, string> = Object.fromEntries(request.headers.entries());
    headers['Content-Type'] = 'application/json';
    headers['Cache-Control'] = 'no-store';
    // Normalize Authorization casing
    if (authHeader) {
      headers['Authorization'] = authHeader;
      headers['authorization'] = authHeader;
    } else {
      return NextResponse.json({ message: 'Authorization header required' }, { status: 401 });
    }
    
    console.log('Outgoing headers:', headers);
    console.log('Target URL:', `${API_BASE_URL}/user/statistics/detailed`);
    console.log('==========================================');
    
    const response = await fetch(`${API_BASE_URL}/user/statistics/detailed`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Backend response data:', data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy statistics detailed error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
