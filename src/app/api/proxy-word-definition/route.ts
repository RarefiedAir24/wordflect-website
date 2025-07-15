import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get('word');
  if (!word) {
    return NextResponse.json({ error: 'Missing word parameter' }, { status: 400 });
  }

  try {
    const apiRes = await fetch(`https://api.wordflect.com/word/definition?word=${encodeURIComponent(word)}`);
    const data = await apiRes.json();
    return NextResponse.json(data, { status: apiRes.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch word definition' }, { status: 500 });
  }
} 