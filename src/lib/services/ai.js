import prisma from "../prisma";
import config from "../config";
import { deductCredits, addCredits } from "./user";

/**
 * Dynamically calculate generation cost based on rules:
 * - Google Veo 3.1: 500 credits flat for 8 sec
 * - OpenAI Sora 2 Pro:
 *   - 720p: 60 credits/sec
 *   - 1080p: 100 credits/sec
 */
export function getGenerationCost(modelKey, params) {
  const isVeo = modelKey.includes("veo");
  if (isVeo) {
    return 500;
  } else {
    const duration = parseInt(params?.duration, 10) || 8;
    const resolution = params?.resolution || "720p";
    const rate = resolution === "1080p" ? 100 : 60;
    return duration * rate;
  }
}

/**
 * Submit an AI video generation request to MuAPI.
 */
export async function submitGeneration(userId, modelKey, params, customApiKey = null) {
  if (!userId) {
    throw new Error("Authentication required.");
  }

  const model = config.ai.models[modelKey];
  if (!model) {
    throw new Error(`Invalid model selection: ${modelKey}`);
  }

  const { prompt, imageUrl, aspectRatio = "16:9", duration = 8, resolution = "720p" } = params;
  if (!prompt || prompt.trim() === "") {
    throw new Error("A prompt is required for video generation.");
  }

  const isUsingCustomKey = Boolean(customApiKey && customApiKey.trim().length > 0);
  const cost = isUsingCustomKey ? 0 : getGenerationCost(modelKey, { duration, resolution });

  // Deduct credits first if not using custom key
  if (!isUsingCustomKey && cost > 0) {
    const deducted = await deductCredits(userId, cost);
    if (!deducted) {
      throw new Error("Insufficient credits. Please purchase a credit pack.");
    }
  }

  // Build payload based on model input specifications
  const payload = {
    prompt: prompt.trim(),
    aspect_ratio: aspectRatio,
  };

  // Add model specific parameters
  if (model.type === "i2v") {
    if (!imageUrl) {
      // Refund credits if imageUrl is missing and was deducted
      if (!isUsingCustomKey && cost > 0) {
        await addCredits(userId, cost);
      }
      throw new Error("Start frame image is required for Image-to-Video models.");
    }
    payload.images_list = [imageUrl];
  }

  if (model.family === "sora") {
    payload.duration = parseInt(duration, 10) || 8;
    if (modelKey.includes("pro")) {
      payload.resolution = resolution;
    }
  }

  const apiKey = isUsingCustomKey ? customApiKey.trim() : (config.ai.apiKey || "");

  try {
    const webhookUrl = `${config.auth.webhook_url}/api/webhook/muapi`;
    const apiUrl = `https://api.muapi.ai/api/v1/${model.endpoint}?webhook=${encodeURIComponent(webhookUrl)}`;

    console.log(`[AI SERVICE] Sending request to MuAPI: ${apiUrl}`, payload);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MuAPI submission failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[AI SERVICE] MuAPI response:`, result);

    // Support both direct structure and wrapped "data" structure
    const requestId = result.data?.request_id || result.id || result.request_id || result.output?.id;
    if (!requestId) {
      throw new Error("Did not receive a valid request ID from MuAPI.");
    }

    // Create DB entry for tracking
    const creation = await prisma.reliveCreation.create({
      data: {
        userId,
        prompt: prompt.trim(),
        imageUrl: imageUrl || null,
        aspectRatio,
        resolution: modelKey.includes("pro") ? resolution : null,
        duration: model.family === "sora" ? parseInt(duration, 10) : 8,
        modelFamily: model.family,
        modelVariant: modelKey,
        status: "processing",
        requestId,
        imagesList: imageUrl ? [imageUrl] : [],
        videoFiles: [],
      },
    });

    return creation;
  } catch (error) {
    console.error("[AI SERVICE] Generation submission error:", error);
    // Refund credits to the user if deducted
    if (!isUsingCustomKey && cost > 0) {
      console.log(`[AI SERVICE] Refunding ${cost} credits to user ${userId} due to submission error.`);
      await addCredits(userId, cost);
    }
    throw error;
  }
}

/**
 * Polls the current status of a generation task from MuAPI and updates the database.
 */
export async function checkAndUpdateStatus(requestId, customApiKey = null) {
  if (!requestId) return null;

  const creation = await prisma.reliveCreation.findUnique({
    where: { requestId },
  });

  if (!creation) {
    console.error(`[AI SERVICE] ReliveCreation with requestId ${requestId} not found in DB.`);
    return null;
  }

  // If already done, just return it
  if (creation.status !== "processing") {
    return creation;
  }

  const isUsingCustomKey = Boolean(customApiKey && customApiKey.trim().length > 0);
  const apiKey = isUsingCustomKey ? customApiKey.trim() : (config.ai.apiKey || "");

  try {
    const pollUrl = `https://api.muapi.ai/api/v1/predictions/${requestId}/result`;
    const response = await fetch(pollUrl, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      console.warn(`[AI SERVICE] Status check failed for ${requestId}: ${response.status}`);
      return creation;
    }

    const result = await response.json();
    console.log(`[AI SERVICE] Poll result for ${requestId}:`, result);

    const status = result.data?.status || result.status;
    const errorMsg = result.data?.error || result.error;

    if (status === "completed") {
      // Find output video URL
      const videoUrl = result.video?.url || result.outputs?.[0] || result.data?.outputs?.[0] || result.data?.video?.url;

      if (!videoUrl) {
        console.error(`[AI SERVICE] Task ${requestId} marked completed but no video URL found.`, result);
        return creation;
      }

      return await prisma.reliveCreation.update({
        where: { requestId },
        data: {
          status: "completed",
          videoFiles: {
            set: [videoUrl],
          },
        },
      });
    } else if (status === "failed") {
      if (!isUsingCustomKey) {
        const cost = getGenerationCost(creation.modelVariant, {
          duration: creation.duration,
          resolution: creation.resolution,
        });
        console.log(`[AI SERVICE] Task ${requestId} failed. Refunding ${cost} credits to user ${creation.userId}.`);
        await addCredits(creation.userId, cost);
      }

      return await prisma.reliveCreation.update({
        where: { requestId },
        data: {
          status: "failed",
          error: errorMsg || "Generation failed in AI pipeline.",
        },
      });
    }

    return creation;
  } catch (error) {
    console.error(`[AI SERVICE] Error polling status for ${requestId}:`, error);
    return creation;
  }
}
