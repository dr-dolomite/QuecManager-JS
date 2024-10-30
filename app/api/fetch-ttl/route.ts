// app/api/quick-stats/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://192.168.224.1/cgi-bin/advance/ttl.sh');
    const data = await response.json();
    console.log('Fetched quick stats:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}