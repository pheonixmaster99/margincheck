import "server-only";

import type { ResponseInputContent } from "openai/resources/responses/responses";
import { parseReceiptAnalysis } from "@/lib/receipt-analysis";
import type { AuthorizedReceiptSource } from "@/lib/receipt-analysis-endpoint";
import { getOpenAIClient, getOpenAIModel } from "@/lib/server/openai";
import type { ReceiptAnalysis } from "@/types/receipt-analysis";

const RECEIPT_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    vendor: {
      type: ["string", "null"],
      description: "Merchant or vendor shown on the receipt, or null when unclear.",
    },
    date: {
      type: ["string", "null"],
      description: "Unambiguous transaction date normalized to YYYY-MM-DD, or null.",
    },
    total: {
      type: ["number", "null"],
      description: "Final total paid or final transaction total, or null when unclear.",
    },
    currency: {
      type: ["string", "null"],
      enum: ["CAD", "USD", "EUR", "GBP", "AUD", "NZD", null],
      description: "Currency supported by MarginCheck when evidenced by the receipt, or null.",
    },
    category: {
      type: ["string", "null"],
      enum: ["materials", "subcontractor", "other", null],
      description: "Editable suggested expense category, or null when unclear.",
    },
    notes: {
      type: ["string", "null"],
      description: "A short useful description of the purchase, or null.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Overall extraction confidence.",
    },
    uncertainFields: {
      type: "array",
      items: { type: "string" },
      description: "Names of fields that are unreadable, ambiguous, or uncertain.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Short plain-language warnings about meaningful receipt ambiguity.",
    },
  },
  required: [
    "vendor",
    "date",
    "total",
    "currency",
    "category",
    "notes",
    "confidence",
    "uncertainFields",
    "warnings",
  ],
} as const;

const RECEIPT_EXTRACTION_INSTRUCTIONS = `You extract a proposed expense from one contractor receipt.

Extract only values visible in the supplied receipt. Never invent missing values; return null when a value is absent, unreadable, or unclear. Prefer the final total paid or final transaction total. Do not confuse subtotal, tax, change, discounts, savings, balance, loyalty points, card numbers, authorization codes, or receipt numbers with the final total. Normalize a date to YYYY-MM-DD only when it is unambiguous. Do not assume a receipt using a dollar symbol is CAD or USD without supporting evidence. Suggest materials, subcontractor, or other only as a user-editable category proposal. Keep notes short and useful. List unclear fields in uncertainFields and add plain-language warnings for meaningful ambiguity. If the document is not a receipt or cannot support a field, return null for that field and explain the issue through uncertainFields or warnings. Do not provide reasoning or chain-of-thought.`;

function receiptInput(source: AuthorizedReceiptSource): ResponseInputContent {
  const base64 = Buffer.from(source.bytes).toString("base64");
  if (source.mimeType === "application/pdf") {
    return {
      type: "input_file",
      filename: source.filename,
      file_data: `data:application/pdf;base64,${base64}`,
      detail: "high",
    };
  }
  return {
    type: "input_image",
    image_url: `data:${source.mimeType};base64,${base64}`,
    detail: "high",
  };
}

export async function analyzeReceipt(
  source: AuthorizedReceiptSource,
): Promise<ReceiptAnalysis> {
  const response = await getOpenAIClient().responses.create({
    model: getOpenAIModel(),
    store: false,
    max_output_tokens: 1_000,
    instructions: RECEIPT_EXTRACTION_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this receipt as an expense proposal. The related job uses ${source.jobCurrency}; do not use that fact as proof of the receipt currency.`,
          },
          receiptInput(source),
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "margincheck_receipt_analysis",
        description: "A proposed MarginCheck expense extracted from a receipt.",
        strict: true,
        schema: RECEIPT_ANALYSIS_SCHEMA,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("The receipt analysis response did not contain structured output.");
  }
  return parseReceiptAnalysis(response.output_text, source.jobCurrency);
}
