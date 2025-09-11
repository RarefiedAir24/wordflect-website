import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    console.log('📤 Proxy: Forwarding missions request to:', `${API_BASE_URL}/user/missions`);
    console.log('📤 Proxy: Request headers:', {
      authorization: headers.authorization ? 'Bearer [REDACTED]' : 'No auth header',
      contentType: headers['content-type'],
      userAgent: headers['user-agent']
    });
    
    const response = await fetch(`${API_BASE_URL}/user/missions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
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
