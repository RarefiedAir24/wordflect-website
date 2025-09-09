import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://api.wordflect.com';

// Try different possible signin endpoints
const SIGNIN_ENDPOINTS = [
  '/signin',
  '/auth/signin', 
  '/user/signin',
  '/api/signin',
  '/auth/login',
  '/user/login'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    console.log('📤 Proxy: Forwarding signin request to:', `${API_BASE_URL}/signin`);
    console.log('📤 Proxy: Request body:', body);
    console.log('📤 Proxy: Request headers:', Object.fromEntries(request.headers.entries()));
    
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
    
    // Test all possible signin endpoints
    console.log('📤 Proxy: Testing all possible signin endpoints');
    let workingEndpoint = null;
    
    for (const endpoint of SIGNIN_ENDPOINTS) {
      try {
        console.log(`📤 Proxy: Testing endpoint: ${endpoint}`);
        const testResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log(`📤 Proxy: ${endpoint} - Status: ${testResponse.status}`);
        
        if (testResponse.status !== 403) {
          console.log(`📤 Proxy: Found working endpoint: ${endpoint}`);
          workingEndpoint = endpoint;
          break;
        }
      } catch (testError) {
        console.log(`📤 Proxy: ${endpoint} - Error:`, testError);
      }
    }
    
    // Use the working endpoint or default to /signin
    const finalEndpoint = workingEndpoint || '/signin';
    console.log(`📤 Proxy: Using endpoint: ${finalEndpoint}`);
    
    // Check what API key we're using
    const apiKey = process.env.WORDFLECT_API_KEY || 'NO_API_KEY_SET';
    console.log('🔑 API Key Status:', {
      hasApiKey: !!process.env.WORDFLECT_API_KEY,
      apiKeyLength: apiKey.length,
      apiKeyPreview: apiKey.substring(0, 10) + '...'
    });
    
    // Last attempt - try minimal request with just email/password
    console.log('📤 Proxy: Attempting minimal request');
    console.log('📤 Proxy: Request body:', JSON.stringify(requestData, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    console.log('📤 Proxy: Raw response status:', response.status);
    console.log('📤 Proxy: Raw response statusText:', response.statusText);
    
    // If still 403, let's try to get more info about the API
    if (response.status === 403) {
      console.log('🚨 API is rejecting all web requests. Possible causes:');
      console.log('1. API is mobile-app only');
      console.log('2. Missing required authentication');
      console.log('3. Wrong API base URL');
      console.log('4. API endpoint has changed');
      
      // Return a helpful error message to the user
      return NextResponse.json({ 
        error: 'API Access Denied',
        message: 'The API is rejecting web requests. This may be a mobile-app only API.',
        details: 'Contact the API provider to enable web access or get proper authentication credentials.',
        apiResponse: await response.text()
      }, { status: 403 });
    }
    console.log('📤 Proxy: Fetch request completed, status:', response.status);

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
