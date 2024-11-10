// app/api/quick-stats/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://192.168.224.1/cgi-bin/fetch_data.sh?set=3');
    const data = await response.json();
    console.log('About Data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}