import { NextRequest, NextResponse } from 'next/server';

// Define the expected response type
interface ATResponse {
  command: string;
  output: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json(
        { error: 'TTL Value is Required' }, 
        { status: 400 }
      );
    }

    // Encode the command to handle special characters
    const encodedCommand = encodeURIComponent(command);

    const response = await fetch('http://192.168.224.1/cgi-bin/advance/ttl.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `ttl=${encodedCommand}`,
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ATResponse = await response.json();
    console.log('TTL Response:', data);

    // If response is success: true, return the response
    if (data.output) {
      return NextResponse.json(data);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('AT command error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `AT command failed: ${error.message}` }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'AT command failed with unknown error' }, 
      { status: 500 }
    );
  }
}