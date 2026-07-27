import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { checkAndUpdateStatus } from "@/lib/services/ai";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json({ error: "requestId query parameter is required." }, { status: 400 });
    }

    const headerApiKey = req.headers.get("x-custom-api-key");
    const customApiKey = headerApiKey || session.user.customApiKey || null;

    const updatedCreation = await checkAndUpdateStatus(requestId, customApiKey);
    if (!updatedCreation) {
      return NextResponse.json({ error: "Creation not found." }, { status: 404 });
    }

    // Verify ownership
    if (updatedCreation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 403 });
    }

    return NextResponse.json({ creation: updatedCreation });
  } catch (error) {
    console.error("[CHECK STATUS API] Error checking status:", error);
    return NextResponse.json({ error: "Failed to check status." }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
