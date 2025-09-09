import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Test: Checking if API is reachable at:', API_BASE_URL);
    
    // Test basic connectivity
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Wordflect-Web/1.0'
      }
    });

    console.log('🧪 Test: Response status:', response.status);
    console.log('🧪 Test: Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('🧪 Test: Response body:', text);
    
    return NextResponse.json({
      apiUrl: API_BASE_URL,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: text.substring(0, 500) // Limit response size
    });
  } catch (error) {
    console.error('🧪 Test: Error:', error);
    return NextResponse.json({ 
      error: 'API test failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      apiUrl: API_BASE_URL
    }, { status: 500 });
  }
}
