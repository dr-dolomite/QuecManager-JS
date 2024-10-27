import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword && !newPassword) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const encodedOldPassword = encodeURIComponent(oldPassword);
    const encodedNewPassword = encodeURIComponent(newPassword);

    const response = await fetch('/cgi-bin/settings/change-password.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `oldPassword=${encodedOldPassword}&newPassword=${encodedNewPassword}`,
    });

    const data = await response.json();

    if (data.state === 'success') {
      return NextResponse.json({ success: true, message: 'Password changed successfully!' });
    } else {
      return NextResponse.json({ success: false, message: 'Something went wrong.' }, { status: 401 });
    }

  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}