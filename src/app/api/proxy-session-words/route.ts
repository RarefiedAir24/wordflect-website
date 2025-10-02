import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('🟢 Proxy session words route called');
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '';
    const targetUrl = new URL(`${API_BASE_URL}/user/session-words`);
    if (range) targetUrl.searchParams.set('range', range);

    console.log('🟢 Target URL:', targetUrl.toString());

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      }
    });

    const data = await response.json();
    console.log('🟢 Response data:', data);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy session words error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
