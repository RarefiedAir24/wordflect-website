import { NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET() {
  try {
    console.log('🕐 PROXY NEXT RESET CALLED');

    const targetUrl = new URL(`${API_BASE_URL}/missions/next-reset`);

    console.log('Proxying request to backend URL:', targetUrl.toString());

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Backend response status:', response.status);
    const data = await response.json();
    console.log('Backend response data:', data);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy next reset error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
