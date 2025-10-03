import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('=== TEST STATISTICS API ===');
    
    // Extract Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', authHeader);
    
    if (!authHeader) {
      return NextResponse.json({ 
        error: 'No Authorization header provided',
        receivedHeaders: Object.fromEntries(request.headers.entries())
      }, { status: 400 });
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    };
    
    console.log('Making request to:', `${API_BASE_URL}/user/statistics/detailed`);
    console.log('With headers:', headers);
    
    const response = await fetch(`${API_BASE_URL}/user/statistics/detailed`, {
      method: 'GET',
      headers
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Backend response data:', data);
    
    return NextResponse.json({
      status: response.status,
      data,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      responseHeaders: Object.fromEntries(response.headers.entries())
    }, { status: response.status });
    
  } catch (error) {
    console.error('Test statistics API error:', error);
    return NextResponse.json({ 
      error: 'Test request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
