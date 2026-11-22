import { NextResponse } from "next/server";

// Static-export friendly: GitHub Pages builds (NEXT_PUBLIC_BASE_PATH set)
// prerender this GET handler instead of running a server.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}