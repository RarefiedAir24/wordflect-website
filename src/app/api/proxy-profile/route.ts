import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://fo0rh1w8m9.execute-api.us-east-2.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    // Forward query parameters (e.g., cache-busting _t parameter) to backend
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const backendUrl = queryString 
      ? `${API_BASE_URL}/user/profile?${queryString}`
      : `${API_BASE_URL}/user/profile`;
    
    console.log('📤 Proxy: Forwarding profile request to:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      }
    });

    console.log('📥 Proxy: Response status:', response.status);
    
    const data = await response.json();
    console.log('📥 Proxy: Profile data received:', JSON.stringify(data, null, 2));
    console.log('📥 Proxy: Profile image URL:', data.profileImageUrl);
    console.log('📥 Proxy: Selected frame:', data.selectedFrame);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
