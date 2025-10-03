import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG SESSION WORDS CALLED');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    
    // Log all headers
    const headers = Object.fromEntries(request.headers.entries());
    console.log('All headers:', headers);
    
    // Check for Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header:', authHeader ? `present (${authHeader.length} chars)` : 'missing');
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';
    const timezone = searchParams.get('timezone') || '';
    
    console.log('Query params - range:', range, 'timezone:', timezone);
    
    // Build target URL
    const targetUrl = new URL(`${API_BASE_URL}/user/session-words`);
    targetUrl.searchParams.set('range', range);
    if (timezone) targetUrl.searchParams.set('timezone', timezone);
    
    console.log('Target URL:', targetUrl.toString());
    
    // Prepare headers
    const outgoingHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authHeader) {
      outgoingHeaders['Authorization'] = authHeader;
      console.log('Authorization header added to outgoing request');
    } else {
      console.log('No Authorization header found in incoming request');
    }
    
    console.log('Outgoing headers:', outgoingHeaders);
    
    // Make the request
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: outgoingHeaders
    });
    
    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Backend response data:', data);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      debug: {
        authHeader: authHeader ? 'present' : 'missing',
        backendStatus: response.status,
        backendResponse: data,
        targetUrl: targetUrl.toString(),
        outgoingHeaders
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Debug session words error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Debug request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}