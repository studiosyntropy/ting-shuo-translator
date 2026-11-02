import { GoogleGenAI, Type } from '@google/genai';

// Server-side translation endpoint.
// The Gemini API key is read here, on Vercel's server, from the
// GEMINI_API_KEY environment variable. It is never sent to the browser.

const MAX_INPUT_LENGTH = 5000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'The server is missing its Gemini API key.' }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const fullText = typeof body?.text === 'string' ? body.text.trim() : '';
  const sourceLang = body?.sourceLang === 'zh-TW' ? 'zh-TW' : 'en-US';
  const translationStyle = body?.translationStyle === 'Formal' ? 'Formal' : 'Natural';
  const recipientGender = body?.recipientGender === 'Female' ? 'Female' : 'Male';

  if (!fullText) {
    return jsonResponse({ error: 'Please enter some text.' }, 400);
  }
  if (fullText.length > MAX_INPUT_LENGTH) {
    return jsonResponse({ error: `Text is too long (maximum ${MAX_INPUT_LENGTH} characters).` }, 400);
  }

  const sourceName = sourceLang === 'en-US' ? 'English' : 'Taiwanese Traditional Chinese';
  const targetName = sourceLang === 'en-US' ? 'Taiwanese Traditional Chinese' : 'English';

  const styleInstruction = translationStyle === 'Formal'
    ? "- Style: Formal. Use high-level honorifics (e.g., 您), official structure, and polite phrasing suitable for writing to a landlord, government official, or professor in Taiwan."
    : "- Style: Conversational and natural. Polite but direct.";

  const genderInstruction = recipientGender === 'Female'
    ? "- Gender Context: The recipient is female. Ensure the written translation uses the feminine '妳' for 'you' in natural contexts. Adjust formal honorifics appropriately (e.g., using '女士' or '小姐' for formal correspondence)."
    : "- Gender Context: The recipient is male. Ensure the written translation uses the masculine '你' for 'you' in natural contexts. Adjust formal honorifics appropriately (e.g., using '先生' for formal correspondence).";

  const pinyinTarget = sourceLang === 'en-US' ? 'translation' : 'corrected_source';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `Process the following raw speech-to-text input:\n\n"${fullText}"`,
      config: {
        systemInstruction: `You are the core intelligence engine for "聽說 TīngShuō," a high-end bilingual translation and editing application specialized for English and Taiwanese Traditional Chinese. You act as a native speaker from Taiwan with deep expertise in Syntropic Agroforestry (趨合農業) and soil science.

Source language: ${sourceName}
Target language: ${targetName}

Core Objectives:

1. Voice-First Processing (STT): Your primary input is raw Speech-to-Text transcription. You must intelligently clean this input by removing filler words (um, uh, 那个), correcting homophones, and adding proper punctuation/capitalization to the source text before translating.

2. Auto-Correction: Fix any grammatical or logical errors in the source language to ensure the "corrected_source" is professional and clear.

3. Taiwanese Localization: All Traditional Chinese output must strictly adhere to Taiwanese usage, vocabulary, and grammar. Avoid all Mainland China idioms (e.g., use 影片 not 視頻, 軟體 not 軟件, 品質 not 質量).

4. Specialized Technical Terminology: Strictly apply these translations for agricultural and ecological contexts:
    - "Target crop" -> "主要作物"
    - "Soil food web" -> "土壤食物網"
    - "Rhizophagy cycle" -> "根噬循環"
    - "Natural cycles" -> "大自然循環"
    - "Succession" -> "演替"
    - "Strata" -> "分層"
    - "Syntropic agroforestry" -> "趨合農業"

Pinyin Standards (CRITICAL): The 'pinyin' field MUST include proper Unicode tone marks above the vowels for every single syllable that carries a tone.
- INCORRECT: Nin hao, jinlai ke hao (No tone marks)
- INCORRECT: Nin2 hao3, jin4lai2 ke3 hao3 (Numbered tones)
- CORRECT: Nín hǎo, jìnlái kě hǎo (Proper Unicode tone marks)
You are strictly forbidden from outputting Pinyin without Unicode tone marks unless a syllable is grammatically neutral.
It must contain ONLY Pinyin text. Do not include Hanzi/Characters. Since the translation direction is ${sourceName} -> ${targetName}, the Pinyin MUST accurately reflect the exact pronunciation of the Chinese text in the '${pinyinTarget}' field.

Tone and Style:
${styleInstruction}
${genderInstruction}
- For English translations, use modern, idiomatic English.

Output Requirements:
Return ONLY a valid JSON object. Do not include any introductory text, markdown explanations, or closing remarks.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            corrected_source: { type: Type.STRING, description: "The input text after spelling and grammar fixes." },
            translation: { type: Type.STRING, description: "The localized translation." },
            pinyin: { type: Type.STRING, description: "The Hanyu Pinyin for the Chinese text (without the Hanzi characters)." }
          },
          required: ["corrected_source", "translation", "pinyin"]
        }
      }
    });

    if (!response.text) {
      return jsonResponse({ error: 'No response from AI' }, 502);
    }

    return jsonResponse(JSON.parse(response.text));
  } catch (err: any) {
    console.error(err);
    return jsonResponse({ error: err?.message || 'An error occurred during translation.' }, 500);
  }
}
