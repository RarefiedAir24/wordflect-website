import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

// Ensure Node.js runtime and disable edge caching for auth header forwarding
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ message: 'Authorization header required' }, { status: 401 });
    }

    // Build pass-through headers and force no-store
    const headers: Record<string, string> = Object.fromEntries(request.headers.entries());
    headers['Content-Type'] = 'application/json';
    headers['Cache-Control'] = 'no-store';
    headers['Authorization'] = authHeader;
    headers['authorization'] = authHeader;

    // Forward the request to the backend API
    const response = await fetch(`${API_BASE_URL}/user/time/analytics`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy time analytics error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
