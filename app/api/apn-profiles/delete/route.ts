// app/api/apn-profiles/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface APNResponse {
    status: 'success' | 'error';
    message: string;
  }

async function makeCGIRequest(scriptPath: string, method: string, data?: URLSearchParams) {
    const response = await fetch(`/cgi-bin/cell-settings/${scriptPath}`, {
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data?.toString(),
      signal: AbortSignal.timeout(10000),
    });

    console.log('response:', response);
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return await response.json() as APNResponse;
  }

export async function POST(request: NextRequest) {
  try {
    const data = await makeCGIRequest('delete-apn-profile.sh', 'POST');

    if (data.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: data.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting APN profiles:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete APN profiles'
      },
      { status: 500 }
    );
  }
}