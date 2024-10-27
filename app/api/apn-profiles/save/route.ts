// app/api/apn-profiles/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface APNProfile {
  iccidProfile1: string;
  apnProfile1: string;
  pdpType1: string;
  iccidProfile2?: string;
  apnProfile2?: string;
  pdpType2?: string;
}

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

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json() as APNResponse;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as APNProfile;
    
    if (!body.iccidProfile1 || !body.apnProfile1 || !body.pdpType1) {
      return NextResponse.json(
        { status: 'error', message: 'Profile 1 is required' },
        { status: 400 }
      );
    }

    const formData = new URLSearchParams();
    formData.append('iccidProfile1', body.iccidProfile1);
    formData.append('apnProfile1', body.apnProfile1);
    formData.append('pdpType1', body.pdpType1);

    if (body.iccidProfile2) {
      formData.append('iccidProfile2', body.iccidProfile2);
      formData.append('apnProfile2', body.apnProfile2 || '');
      formData.append('pdpType2', body.pdpType2 || '');
    }

    const data = await makeCGIRequest('apn-profile.sh', 'POST', formData);

    if (data.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: data.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving APN profiles:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save APN profiles'
      },
      { status: 500 }
    );
  }
}