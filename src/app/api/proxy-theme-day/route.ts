import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const targetUrl = new URL(`${API_BASE_URL}/user/theme/day`);
    if (date) targetUrl.searchParams.set('date', date);

    console.log('📤 Theme Day Proxy: Forwarding request to:', targetUrl.toString());
    console.log('📤 Theme Day Proxy: Date parameter:', date);
    console.log('📤 Theme Day Proxy: Headers:', Object.fromEntries(request.headers.entries()));

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      }
    });

    console.log('📥 Theme Day Proxy: Response status:', response.status);
    
    const data = await response.json();
    console.log('📥 Theme Day Proxy: Response data:', JSON.stringify(data, null, 2));
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy theme day error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
