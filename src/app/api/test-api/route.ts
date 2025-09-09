import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com';

export async function GET() {
  try {
    console.log('🧪 Test: Checking if API is reachable at:', API_BASE_URL);
    
    // Test multiple possible API URLs
    const testUrls = [
      `${API_BASE_URL}/`,
      `${API_BASE_URL}/signin`,
      `${API_BASE_URL}/api/signin`,
      `${API_BASE_URL}/auth/signin`,
      'https://dev-api.wordflect.com/',
      'https://dev-api.wordflect.com/signin',
      'https://wordflect-api.vercel.app/',
      'https://wordflect-api.vercel.app/signin'
    ];
    
    const results = [];
    
    for (const url of testUrls) {
      try {
        console.log('🧪 Test: Trying URL:', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Wordflect-Web/1.0'
          }
        });

        const text = await response.text();
        results.push({
          url,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: text.substring(0, 200) // Limit response size
        });
        
        console.log('🧪 Test: URL', url, 'Status:', response.status);
      } catch (error) {
        results.push({
          url,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.log('🧪 Test: URL', url, 'Error:', error);
      }
    }
    
    return NextResponse.json({
      apiUrl: API_BASE_URL,
      results
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
