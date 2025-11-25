// app/api/klines/route.ts (App Router)
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval");
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");

  if (!symbol || !interval || !startTime || !endTime) {
    return NextResponse.json(
      { error: "Missing query parameters" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://api.backpack.exchange/api/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
