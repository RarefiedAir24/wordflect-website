import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    // Log all incoming headers for debugging
    console.log('=== PROXY STATISTICS DETAILED DEBUG ===');
    console.log('All incoming headers:', Object.fromEntries(request.headers.entries()));
    
    // Extract Authorization header specifically
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header received:', authHeader);
    
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
    
    console.log('Outgoing headers:', headers);
    console.log('Target URL:', `${API_BASE_URL}/user/statistics/detailed`);
    console.log('==========================================');
    
    const response = await fetch(`${API_BASE_URL}/user/statistics/detailed`, {
      method: 'GET',
      headers
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Backend response data:', data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy statistics detailed error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
