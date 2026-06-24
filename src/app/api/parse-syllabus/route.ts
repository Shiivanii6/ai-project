import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000"}`;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    const response = await fetch(`${BACKEND_URL}/api/parse-syllabus`, { // Call Vercel serverless Python
      method: "POST",
      body: formData,
    });

    const text = await response.text();

    if (!response.ok) {
      return new NextResponse(text || "Backend request failed", {
        status: response.status,
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      return new NextResponse("Invalid JSON returned from backend", { status: 502 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return new NextResponse(`Proxy request failed: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
    });
  }
}
