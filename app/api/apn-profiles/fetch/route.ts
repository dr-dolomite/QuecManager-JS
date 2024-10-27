// app/api/quick-stats/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('/cgi-bin/cell-settings/fetch-apn-profiles.sh');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}