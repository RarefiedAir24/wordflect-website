import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== TEST PROXY SIMPLE ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    
    // Log all headers
    const headers = Object.fromEntries(request.headers.entries());
    console.log('All headers:', headers);
    
    // Check for Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header:', authHeader ? `present (${authHeader.length} chars)` : 'missing');
    
    // Test the backend API directly
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';
    const targetUrl = `${API_BASE_URL}/user/session-words`;
    
    console.log('Testing backend API:', targetUrl);
    
    const testHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authHeader) {
      testHeaders['Authorization'] = authHeader;
    }
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: testHeaders
    });
    
    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Backend response body:', responseText);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      testResults: {
        authHeader: authHeader ? 'present' : 'missing',
        backendStatus: response.status,
        backendResponse: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
      }
    });
  } catch (error) {
    console.error('Test proxy error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
