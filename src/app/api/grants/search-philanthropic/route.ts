import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Philanthropic grant search is disabled" },
    { status: 404 }
  );
}
