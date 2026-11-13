/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Server-Side Gemini Chatbot & Google Search Grounding Service
 * All @google/genai SDK calls run strictly on the server.
 */

import { GoogleGenAI, Content, GenerateContentResponse } from '@google/genai';
import { extractGroundingSources, GroundingSourceLink } from '../logic/diagnostics_log.js';

export type SupportedLabModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

export interface LabChatRequest {
  history?: ChatTurnInput[];
  message: string;
  model?: SupportedLabModel;
  useSearchGrounding?: boolean;
  deviceContext?: string;
}

export interface LabChatResponse {
  text: string;
  model: SupportedLabModel;
  grounded: boolean;
  sources: GroundingSourceLink[];
  webSearchQueries: string[];
}

function getGenAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiApiHttpError(
      400,
      'Gemini API key is not configured. Please check your key in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeModel(model?: string): SupportedLabModel {
  if (model === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite';
  return 'gemini-4-hydrogen';
}

function extractReadableErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return String(parsed.error.message);
    if (parsed?.message) return String(parsed.message);
  } catch {
    // Check if raw has an embedded JSON payload
    const braceIdx = raw.indexOf('{');
    if (braceIdx >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(braceIdx));
        if (parsed?.error?.message) return String(parsed.error.message);
      } catch {}
    }
  }
  return raw;
}

function mapGeminiError(err: unknown): GeminiApiHttpError {
  if (err instanceof GeminiApiHttpError) return err;
  const msg = extractReadableErrorMessage(err);
  const lower = msg.toLowerCase();

  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('api_key_invalid') || lower.includes('api key')) {
    return new GeminiApiHttpError(
      403,
      `Gemini API access error: ${msg}. Please verify your API key in Settings > Secrets.`
    );
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return new GeminiApiHttpError(
      429,
      `Gemini quota or rate limit reached: ${msg} You can manage or upgrade your API key tier in Settings > Secrets.`
    );
  }
  if (lower.includes('404') || lower.includes('not_found')) {
    return new GeminiApiHttpError(404, `Requested Gemini model unavailable: ${msg}`);
  }
  return new GeminiApiHttpError(502, `Gemini service error: ${msg}`);
}

const LAB_SYSTEM_INSTRUCTION = `You are the DYNOSHI Android Lab Assistant, an expert Android systems engineer specializing in:
- Android Debug Bridge (ADB), USB/TCP-IP debugging, fastboot, and platform-tools troubleshooting
- Official Android Emulator AVDs, Google Play-certified system images (google_apis_playstore), KVM/WHPX hardware acceleration
- Android package management (pm path, com.android.vending, com.google.android.youtube), logcat analysis, and UI automation
- Device hardware specifications (RAM, ABI, API levels, display density)

Rules:
- Provide accurate, concise, technical engineering answers. Use markdown code blocks for exact ADB/emulator commands.
- Never fabricate device telemetry or pretend an unattached device is online.
- When Google Search grounding is enabled, cite factual web findings clearly.`;

export async function runLabChatTurn(req: LabChatRequest): Promise<LabChatResponse> {
  const message = String(req.message || '').trim();
  if (!message) {
    throw new GeminiApiHttpError(400, 'Message cannot be empty.');
  }

  const ai = getGenAiClient();
  const model = normalizeModel(req.model);
  const useSearchGrounding = req.useSearchGrounding !== false;

  const formattedHistory: Content[] = (Array.isArray(req.history) ? req.history : [])
    .filter((h) => (h.role === 'user' || h.role === 'model') && typeof h.text === 'string' && h.text.trim().length > 0)
    .slice(-24)
    .map((h) => ({
      role: h.role,
      parts: [{ text: h.text.trim() }],
    }));

  const contextAddon = req.deviceContext?.trim()
    ? `\n\nActive Lab Device Context:\n${req.deviceContext.trim()}`
    : '';

  try {
    const chat = ai.chats.create({
      model,
      history: formattedHistory,
      config: {
        systemInstruction: `${LAB_SYSTEM_INSTRUCTION}${contextAddon}`,
        ...(useSearchGrounding ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });

    const response: GenerateContentResponse = await chat.sendMessage({
      message,
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const sources = extractGroundingSources(metadata?.groundingChunks);
    const webSearchQueries = Array.isArray(metadata?.webSearchQueries)
      ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string')
      : [];

    return {
      text: response.text ?? 'No response generated.',
      model,
      grounded: useSearchGrounding && (sources.length > 0 || webSearchQueries.length > 0),
      sources,
      webSearchQueries,
    };
  } catch (err) {
    throw mapGeminiError(err);
  }
}

export async function runWebGroundedSearch(
  queryText: string,
  deviceContext?: string
): Promise<LabChatResponse> {
  const cleanQuery = String(queryText || '').trim();
  if (!cleanQuery) {
    throw new GeminiApiHttpError(400, 'Search query cannot be empty.');
  }

  const ai = getGenAiClient();
  const contextAddon = deviceContext?.trim()
    ? `\n\nActive Lab Device Context:\n${deviceContext.trim()}`
    : '';

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: cleanQuery,
      config: {
        systemInstruction: `${LAB_SYSTEM_INSTRUCTION}${contextAddon}`,
        tools: [{ googleSearch: {} }],
      },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const sources = extractGroundingSources(metadata?.groundingChunks);
    const webSearchQueries = Array.isArray(metadata?.webSearchQueries)
      ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string')
      : [];

    return {
      text: response.text ?? 'No grounded search summary generated.',
      model: 'gemini-4-hydrogen',
      grounded: true,
      sources,
      webSearchQueries,
    };
  } catch (err) {
    throw mapGeminiError(err);
  }
}
