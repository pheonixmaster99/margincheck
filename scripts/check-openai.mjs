import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is missing from .env.local.");
}

const client = new OpenAI({ apiKey });
const response = await client.responses.create({
  model,
  input: "Reply with exactly READY.",
  reasoning: { effort: "none" },
  max_output_tokens: 16,
  store: false,
});

if (response.output_text.trim() !== "READY") {
  throw new Error(`OpenAI returned an unexpected health-check response from ${model}.`);
}

console.log(`OpenAI connection verified with ${model}.`);
