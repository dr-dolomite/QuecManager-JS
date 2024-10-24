import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json({ error: 'AT command is required' }, { status: 400 });
    }

    // Encode the command to handle special characters
    const encodedcommand = encodeURIComponent(command);

    const response = await fetch('http://192.168.224.1/cgi-bin/atinout_handler.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `command=${encodedcommand}`,
    });

    const data = await response.json();
    console.log('AT command response:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}