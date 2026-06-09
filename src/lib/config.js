/**
 * Centralized configuration for the Relive AI SaaS application.
 * Contains auth options, stripe configuration, and AI model parameters.
 */
const config = {
  appName: "Relive Ai",
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    webhook_url: process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    plans: {
      starter: { id: "starter", name: "Starter Pack", credits: 100, price: 500 },     // $5.00
      standard: { id: "standard", name: "Standard Pack", credits: 250, price: 1000 }, // $10.00
      pro: { id: "pro", name: "Professional Pack", credits: 600, price: 2000 },        // $20.00
      business: { id: "business", name: "Enterprise Pack", credits: 2000, price: 5000 }, // $50.00
    }
  },
  ai: {
    apiKey: process.env.MUAPIAPP_API_KEY,
    models: {
      // Google Veo 3.1
      "veo3-image-to-video": {
        name: "Google Veo 3.1 Image to Video",
        cost: 45,
        endpoint: "veo3-image-to-video",
        family: "veo",
        type: "i2v"
      },
      // OpenAI Sora 2 Pro
      "openai-sora-2-pro-image-to-video": {
        name: "OpenAI Sora 2 Pro Image to Video",
        cost: 50,
        endpoint: "openai-sora-2-pro-image-to-video",
        family: "sora",
        type: "i2v"
      }
    }
  }
};

// Check for missing keys at startup in node environment
if (typeof window === "undefined") {
  const criticalEnv = [
    ["GOOGLE_CLIENT_ID", config.auth.google.clientId],
    ["GOOGLE_CLIENT_SECRET", config.auth.google.clientSecret],
    ["STRIPE_SECRET_KEY", config.stripe.secretKey],
    ["MUAPIAPP_API_KEY", config.ai.apiKey],
  ];

  criticalEnv.forEach(([name, val]) => {
    if (!val) {
      console.warn(`[CONFIG] Warning: Critical environment variable is missing: ${name}`);
    }
  });
}

export default config;
