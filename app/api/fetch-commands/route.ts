import { NextResponse } from 'next/server';

interface ATCommand {
  command: string;
  description: string;
}

export async function GET() {
  try {
    const response = await fetch('http://192.168.224.1/cgi-bin/advance/fetch_commands.sh');
    const rawData = await response.json();

    // Transform the data into the format needed by the frontend
    const formattedData: ATCommand[] = Object.entries(rawData).map(([description, command]) => ({
      command: command as string,
      description,
    }));

    console.log('Formatted AT Commands Data:', formattedData);
    return NextResponse.json({ commonCommands: formattedData });

  } catch (error) {
    console.error('Error fetching AT commands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AT commands' },
      { status: 500 }
    );
  }
}