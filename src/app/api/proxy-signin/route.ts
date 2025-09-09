import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://api.wordflect.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    console.log('📤 Proxy: Forwarding signin request to:', `${API_BASE_URL}/signin`);
    console.log('📤 Proxy: Request body:', body);
    
    // Parse the request body to validate it
    let requestData;
    try {
      requestData = JSON.parse(body);
      console.log('📤 Proxy: Parsed request data:', requestData);
    } catch (parseError) {
      console.error('📤 Proxy: Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Test with a simple request first
    console.log('📤 Proxy: Making request to:', `${API_BASE_URL}/signin`);
    console.log('📤 Proxy: Request data:', requestData);
    
    const response = await fetch(`${API_BASE_URL}/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Wordflect-Web/1.0',
        'X-API-Key': process.env.WORDFLECT_API_KEY || '',
        'X-Client-Version': '1.0.107',
        'X-Platform': 'web',
        'Origin': 'https://www.wordflect.com',
        'Referer': 'https://www.wordflect.com/signin'
      },
      body: JSON.stringify(requestData) // Re-stringify to ensure proper formatting
    });

    console.log('📥 Proxy: Response status:', response.status);
    console.log('📥 Proxy: Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('📥 Proxy: Non-JSON response:', text);
      data = { message: text };
    }
    
    console.log('📥 Proxy: Response data:', data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      error: 'Proxy request failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
