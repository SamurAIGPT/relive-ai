import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkAndUpdateStatus } from "@/lib/services/ai";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headerApiKey = req.headers.get("x-custom-api-key");
    const customApiKey = headerApiKey || session.user.customApiKey || null;

    // 1. Fetch processing creations first to sync them
    const processingCreations = await prisma.reliveCreation.findMany({
      where: {
        userId: session.user.id,
        status: "processing",
      },
    });

    // 2. On-the-fly status updates for pending items (Step 5.4 webhook bypass)
    if (processingCreations.length > 0) {
      try {
        await Promise.all(
          processingCreations.map((c) => checkAndUpdateStatus(c.requestId, customApiKey))
        );
      } catch (err) {
        console.error("[CREATIONS GET API] Error in robust polling fallback:", err);
      }
    }

    // 3. Fetch full user creations history list
    const creations = await prisma.reliveCreation.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ creations });
  } catch (error) {
    console.error("[CREATIONS GET API] Error fetching creations:", error);
    return NextResponse.json({ error: "Failed to fetch creations" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
