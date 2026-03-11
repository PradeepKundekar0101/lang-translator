import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/app/lib/openrouter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLanguages } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    if (!targetLanguages || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: "At least one target language is required" },
        { status: 400 }
      );
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "Text exceeds maximum length of 50,000 characters" },
        { status: 400 }
      );
    }

    const results = await translateText(text, targetLanguages);

    return NextResponse.json({ translations: results });
  } catch (error) {
    console.error("Translation error:", error);
    const message =
      error instanceof Error ? error.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
