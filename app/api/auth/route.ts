import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const encodedPassword = encodeURIComponent(password);

    const response = await fetch('/cgi-bin/auth.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `password=${encodedPassword}`,
    });

    const data = await response.json();

    if (data.state === 'success') {
      return NextResponse.json({ success: true, message: 'Login successful' });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
    }

  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}