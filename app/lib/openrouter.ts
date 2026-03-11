const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface TranslationResult {
  language: string;
  languageCode: string;
  translatedText: string;
}

export async function translateText(
  text: string,
  targetLanguages: { code: string; name: string }[]
): Promise<TranslationResult[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const languageList = targetLanguages
    .map((l) => `${l.name} (${l.code})`)
    .join(", ");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai-translation-app.local",
      "X-Title": "AI Translation App",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text into the requested languages. 
Return your response as a valid JSON array with objects containing "languageCode", "language", and "translatedText" fields.
Preserve all formatting, line breaks, and structure of the original text.
Do not add any explanations or notes. Return ONLY the JSON array.`,
        },
        {
          role: "user",
          content: `Translate the following text into these languages: ${languageList}

Text to translate:
${text}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from translation API");
  }

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse translation response");
  }

  return JSON.parse(jsonMatch[0]) as TranslationResult[];
}

export async function translateFileContent(
  content: string,
  targetLanguage: { code: string; name: string },
  fileType: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const isStructured = ["html", "xlsx", "csv"].includes(fileType);
  const isPdf = fileType === "pdf";

  let systemPrompt: string;

  if (isPdf) {
    systemPrompt = `You are a professional translator. Translate the following text into ${targetLanguage.name}.
The text is extracted from a PDF document.
Pages are separated by <<<PAGE_BREAK>>> and text blocks within a page are separated by <<<BLOCK_BREAK>>>.
CRITICAL RULES:
- You MUST preserve every <<<PAGE_BREAK>>> marker exactly as-is in your output.
- You MUST preserve every <<<BLOCK_BREAK>>> marker exactly as-is in your output.
- Do NOT remove, rename, reorder, or add any markers.
- Translate all text content while preserving paragraph breaks and structure within each block.
Return ONLY the translated text with all markers intact. No explanations or notes.`;
  } else if (isStructured) {
    systemPrompt = `You are a professional translator. Translate ONLY the human-readable text content into ${targetLanguage.name}. 
Preserve ALL markup, tags, structure, formatting, code, formulas, and non-text elements exactly as they are.
For HTML: translate text content but keep all tags, attributes, and structure intact.
For spreadsheet data: translate cell text content but keep the structure (delimiters, formatting) intact.
Return ONLY the translated content with no explanations.`;
  } else {
    systemPrompt = `You are a professional translator. Translate the following text into ${targetLanguage.name}.
Preserve all formatting, paragraph breaks, bullet points, numbering, and document structure.
Return ONLY the translated text with no explanations or notes.`;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai-translation-app.local",
      "X-Title": "AI Translation App",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content },
      ],
      temperature: 0.3,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const translatedContent = data.choices?.[0]?.message?.content;

  if (!translatedContent) {
    throw new Error("No response from translation API");
  }

  return translatedContent;
}
