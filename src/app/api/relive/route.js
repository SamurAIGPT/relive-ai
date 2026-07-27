import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { submitGeneration } from "@/lib/services/ai";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { modelKey, prompt, imageUrl, aspectRatio, duration, resolution } = body;

    if (!modelKey) {
      return NextResponse.json({ error: "modelKey is required." }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required." }, { status: 400 });
    }

    const headerApiKey = req.headers.get("x-custom-api-key");
    const customApiKey = headerApiKey || body.customApiKey || session.user.customApiKey || null;

    const creation = await submitGeneration(session.user.id, modelKey, {
      prompt,
      imageUrl,
      aspectRatio,
      duration,
      resolution,
    }, customApiKey);

    return NextResponse.json({ success: true, creation });
  } catch (error) {
    console.error("[RELIVE API] Error submitting generation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit video generation." },
      { status: 500 }
    );
  }
}
export const dynamic = "force-dynamic";
