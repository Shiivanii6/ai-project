import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/topic-study-material`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      return new NextResponse(text || "Backend request failed", { status: response.status });
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return new NextResponse("Invalid JSON returned from backend", { status: 502 });
    }
  } catch (error) {
    return new NextResponse(
      `Proxy request failed: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 }
    );
  }
}
