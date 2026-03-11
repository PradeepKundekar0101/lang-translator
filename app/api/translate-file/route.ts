import { NextRequest, NextResponse } from "next/server";
import { parseFile, buildTranslatedFile } from "@/app/lib/file-parser";
import { translateFileContent } from "@/app/lib/openrouter";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const languageCode = formData.get("languageCode") as string;
    const languageName = formData.get("languageName") as string;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!languageCode || !languageName) {
      return NextResponse.json(
        { error: "Target language is required" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const parsed = await parseFile(buffer, file.name, file.type);

    const translatedContent = await translateFileContent(
      parsed.content,
      { code: languageCode, name: languageName },
      parsed.fileType
    );

    const result = await buildTranslatedFile(
      translatedContent,
      parsed.fileType,
      languageCode,
      file.name,
      parsed.pdfMeta,
      buffer
    );

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "X-Translated-Filename": result.fileName,
      },
    });
  } catch (error) {
    console.error("File translation error:", error);
    const message =
      error instanceof Error ? error.message : "File translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
