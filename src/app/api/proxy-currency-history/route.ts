import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('💰 Proxy currency history called');
    
    // Extract Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', !!authHeader);
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const limit = searchParams.get('limit') || '100';
    
    const targetUrl = new URL(`${API_BASE_URL}/user/currency/history`);
    targetUrl.searchParams.set('type', type);
    targetUrl.searchParams.set('limit', limit);

    console.log('💰 Proxy currency history - target URL:', targetUrl.toString());

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add Authorization header if it exists
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('Authorization header added to outgoing request');
    } else {
      console.log('No Authorization header found in incoming request');
    }

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers
    });

    console.log('💰 Proxy currency history - response status:', response.status);

    const data = await response.json();
    console.log('💰 Proxy currency history - response data keys:', Object.keys(data));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy currency history error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}

