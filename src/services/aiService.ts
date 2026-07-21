// import { OpenAI } from "openai";

// const openRouterKey = process.env.OPENROUTER_API_KEY;

// export const openai = new OpenAI({
//   baseURL: "https://openrouter.ai/api/v1",
//   apiKey: openRouterKey || "mock_key_for_compilation",
//   defaultHeaders: {
//     "HTTP-Referer": "http://localhost:3000",
//     "X-Title": "StudySprint",
//   },
// });

// const DEFAULT_MODEL = "google/gemini-2.5-flash";

// interface GenerateOptions {
//   model?: string;
//   systemPrompt?: string;
//   temperature?: number;
//   conversationHistory?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
// }

// // ─── Non-streaming text generation ──────────────────────────────────────────
// export async function generateText(
//   prompt: string,
//   options: GenerateOptions = {}
// ): Promise<string> {
//   const model = options.model || DEFAULT_MODEL;
//   const temperature = options.temperature ?? 0.7;
//   const history = options.conversationHistory || [];

//   const messages = [
//     ...(options.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
//     ...history.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
//     { role: "user" as const, content: prompt },
//   ];

//   const response = await openai.chat.completions.create({ model, temperature, messages });
//   return response.choices[0]?.message?.content || "";
// }

// // ─── Streaming chat (returns the stream, caller pipes it to response) ─────────
// export async function generateStream(
//   messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
//   options: Omit<GenerateOptions, "conversationHistory"> = {}
// ) {
//   const model = options.model || DEFAULT_MODEL;
//   const temperature = options.temperature ?? 0.7;

//   const builtMessages = [
//     ...(options.systemPrompt ? [{ role: "system" as const, content: options.systemPrompt }] : []),
//     ...messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
//   ];

//   return openai.chat.completions.create({
//     model,
//     temperature,
//     messages: builtMessages,
//     stream: true,
//   });
// }

import { OpenAI } from "openai";

const openRouterKey = process.env.OPENROUTER_API_KEY;

export const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: openRouterKey || "mock_key_for_compilation",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "StudySprint",
  },
});

const DEFAULT_MODEL = "openrouter/free";

interface GenerateOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  conversationHistory?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

// ─── Non-streaming text generation ──────────────────────────────────────────
export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> {
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 1000;
  const history = options.conversationHistory || [];

  const messages = [
    ...(options.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }]
      : []),
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    { role: "user" as const, content: prompt },
  ];

  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages,
  });
  return response.choices[0]?.message?.content || "";
}

// ─── Streaming chat (returns the stream, caller pipes it to response) ─────────
export async function generateStream(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: Omit<GenerateOptions, "conversationHistory"> = {},
) {
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 1000;

  const builtMessages = [
    ...(options.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }]
      : []),
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  return openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: builtMessages,
    stream: true,
  });
}
