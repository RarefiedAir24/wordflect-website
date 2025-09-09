import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    console.log('📤 Proxy: Forwarding complete-mission request to:', `${API_BASE_URL}/user/complete-mission`);
    
    const response = await fetch(`${API_BASE_URL}/user/complete-mission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      },
      body
    });

    console.log('📥 Proxy: Response status:', response.status);
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
