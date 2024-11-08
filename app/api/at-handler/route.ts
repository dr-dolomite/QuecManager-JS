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
        { error: 'AT command is required' }, 
        { status: 400 }
      );
    }

    // Encode the command to handle special characters
    const encodedCommand = encodeURIComponent(command);

    const response = await fetch('http://192.168.224.1/cgi-bin/atinout_handler.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `command=${encodedCommand}`,
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ATResponse = await response.json();
    console.log('Command: ', command);
    console.log('AT command response:', data);

    // If response from data have the word "ERROR" in it, throw an error
    if (data.output.includes('ERROR')) {
      throw new Error(data.output);
    }

    // Verify the response has the expected format
    if (!data.output) {
      throw new Error('Invalid response format from AT command handler');
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