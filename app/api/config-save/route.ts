// app/api/config-save/route.ts
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const response = await fetch(
      "/cgi-bin/settings/save-config.sh",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving configuration:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}