import "server-only";

import OpenAI from "openai";
import { ServerConfigurationError } from "@/lib/server/errors";

export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

let openAIClient: OpenAI | null = null;

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServerConfigurationError(
      "OpenAI is not configured. Add OPENAI_API_KEY to the server environment.",
    );
  }

  openAIClient ??= new OpenAI({ apiKey });
  return openAIClient;
}
