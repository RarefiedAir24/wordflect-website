import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get('day');
    const date = searchParams.get('date');
    
    if (!day || !date) {
      return NextResponse.json({ error: 'Missing day or date parameter' }, { status: 400 });
    }

    // Get auth token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Call the backend API
    const backendUrl = `${process.env.BACKEND_URL}/theme-day-details?day=${day}&date=${date}`;
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Backend error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Theme day details API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
