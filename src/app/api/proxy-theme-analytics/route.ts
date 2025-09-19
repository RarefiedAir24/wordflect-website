import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    // Extract Authorization header specifically
    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if it exists
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    console.log('Proxy theme analytics - forwarding headers:', headers);
    
    const response = await fetch(`${API_BASE_URL}/user/theme/analytics`, {
      method: 'GET',
      headers
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy theme analytics error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
