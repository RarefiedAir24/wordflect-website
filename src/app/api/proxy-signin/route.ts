import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    console.log('📤 Proxy: Forwarding signin request to:', `${API_BASE_URL}/signin`);
    console.log('📤 Proxy: Request body:', body);
    
    const response = await fetch(`${API_BASE_URL}/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Wordflect-Web/1.0'
      },
      body
    });

    console.log('📥 Proxy: Response status:', response.status);
    console.log('📥 Proxy: Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('📥 Proxy: Response data:', data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
