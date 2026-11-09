import { FirebaseAuthenticationError, requireFirebaseUser } from "@/lib/server/auth";
import { ServerConfigurationError } from "@/lib/server/errors";
import { getOpenAIModel, isOpenAIConfigured } from "@/lib/server/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  try {
    await requireFirebaseUser(request);

    return Response.json(
      {
        authenticated: true,
        openAIConfigured: isOpenAIConfigured(),
        model: getOpenAIModel(),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    if (error instanceof ServerConfigurationError) {
      return Response.json(
        { error: "The AI service is not configured." },
        { status: 503, headers: noStoreHeaders },
      );
    }

    return Response.json(
      { error: "The AI service could not be checked." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
