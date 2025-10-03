import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== TEST AUTH SIMPLE ===');
    console.log('Request URL:', request.url);
    console.log('Request method:', request.method);
    
    // Log all headers
    const headers = Object.fromEntries(request.headers.entries());
    console.log('All headers:', headers);
    
    // Check for Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header:', authHeader ? `present (${authHeader.length} chars)` : 'missing');
    
    // Check for other auth-related headers
    const cookieHeader = request.headers.get('cookie');
    console.log('Cookie header:', cookieHeader ? `present (${cookieHeader.length} chars)` : 'missing');
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      headers: headers,
      authHeader: authHeader ? `present (${authHeader.length} chars)` : 'missing',
      cookieHeader: cookieHeader ? `present (${cookieHeader.length} chars)` : 'missing'
    });
    
  } catch (error) {
    console.error('Test auth simple error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
