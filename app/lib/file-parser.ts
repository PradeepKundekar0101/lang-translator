import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { PDFDocument, rgb } from "pdf-lib";
import PDFKitDoc from "pdfkit";
import path from "path";
import fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

interface TextLineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextBlock {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface PageLayout {
  lineRects: TextLineRect[];
  blocks: TextBlock[];
}

export interface ParsedFile {
  content: string;
  fileType: string;
  originalName: string;
  pdfMeta?: {
    pageCount: number;
    pageSizes: { width: number; height: number }[];
    pageLayouts: PageLayout[];
  };
}

const PAGE_MARKER = "<<<PAGE_BREAK>>>";
const BLOCK_MARKER = "<<<BLOCK_BREAK>>>";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedFile> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }

  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  switch (extension) {
    case "txt":
    case "csv":
      return {
        content: buffer.toString("utf-8"),
        fileType: extension,
        originalName: fileName,
      };

    case "html":
    case "htm":
      return {
        content: buffer.toString("utf-8"),
        fileType: "html",
        originalName: fileName,
      };

    case "doc":
    case "docx":
      return parseDocx(buffer, fileName);

    case "pdf":
      return parsePdf(buffer, fileName);

    case "xlsx":
    case "xls":
      return parseXlsx(buffer, fileName);

    default:
      if (mimeType.startsWith("text/")) {
        return {
          content: buffer.toString("utf-8"),
          fileType: "txt",
          originalName: fileName,
        };
      }
      throw new Error(`Unsupported file format: .${extension}`);
  }
}

async function parseDocx(
  buffer: Buffer,
  fileName: string
): Promise<ParsedFile> {
  const result = await mammoth.convertToHtml({ buffer });
  return {
    content: result.value,
    fileType: "html",
    originalName: fileName,
  };
}

async function parsePdf(
  buffer: Buffer,
  fileName: string
): Promise<ParsedFile> {
  const existingPdf = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
  });
  const pdfPages = existingPdf.getPages();
  const pageSizes = pdfPages.map((p) => ({
    width: p.getWidth(),
    height: p.getHeight(),
  }));

  const pageLayouts: PageLayout[] = [];
  let pageIndex = 0;

  const options = {
    pagerender: function (pageData: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getTextContent: () => Promise<{ items: any[] }>;
    }) {
      pageIndex++;
      return pageData.getTextContent().then(function (textContent) {
        // Collect raw text items with positions
        const items: {
          x: number;
          y: number;
          width: number;
          height: number;
          str: string;
        }[] = [];

        for (const item of textContent.items) {
          const x: number = item.transform[4];
          const y: number = item.transform[5];
          const height: number = Math.abs(item.transform[3]) || 12;
          const width: number =
            item.width ||
            item.str.length * Math.abs(item.transform[0]) * 0.6;
          items.push({ x, y, width, height, str: item.str });
        }

        // Group items into lines by Y coordinate (tolerance ±3pt)
        const lineMap = new Map<
          number,
          typeof items
        >();
        const yTolerance = 3;

        for (const item of items) {
          let foundKey: number | null = null;
          for (const key of lineMap.keys()) {
            if (Math.abs(key - item.y) < yTolerance) {
              foundKey = key;
              break;
            }
          }
          if (foundKey !== null) {
            lineMap.get(foundKey)!.push(item);
          } else {
            lineMap.set(item.y, [item]);
          }
        }

        // Build sorted lines (highest Y first = visually top-to-bottom)
        const sortedLines = Array.from(lineMap.entries())
          .sort(([a], [b]) => b - a)
          .map(([y, lineItems]) => {
            let minX = Infinity;
            let maxX = -Infinity;
            let maxH = 0;
            for (const item of lineItems) {
              if (item.str.trim()) {
                minX = Math.min(minX, item.x);
                maxX = Math.max(maxX, item.x + item.width);
              }
              maxH = Math.max(maxH, item.height);
            }
            const text = lineItems
              .sort((a, b) => a.x - b.x)
              .map((i) => i.str)
              .join("");
            return {
              y,
              height: maxH,
              minX: minX === Infinity ? 0 : minX,
              maxX: maxX === -Infinity ? 100 : maxX,
              text,
            };
          });

        // Build per-line white-out rectangles
        const lineRects: TextLineRect[] = sortedLines
          .filter((l) => l.text.trim())
          .map((l) => ({
            x: l.minX,
            y: l.y - 2,
            width: l.maxX - l.minX,
            height: l.height + 6,
          }));

        // Group consecutive lines into blocks.
        // A gap larger than 3x the average line height signals a
        // non-text region (image, graphic, etc.) between blocks.
        const avgHeight =
          sortedLines.length > 0
            ? sortedLines.reduce((s, l) => s + l.height, 0) /
              sortedLines.length
            : 12;
        const gapThreshold = avgHeight * 3;

        const blockGroups: (typeof sortedLines)[] = [];
        let currentGroup: typeof sortedLines = [];

        for (let i = 0; i < sortedLines.length; i++) {
          if (currentGroup.length > 0) {
            const prev = currentGroup[currentGroup.length - 1];
            const gap = prev.y - prev.height - sortedLines[i].y;
            if (gap > gapThreshold) {
              blockGroups.push(currentGroup);
              currentGroup = [];
            }
          }
          currentGroup.push(sortedLines[i]);
        }
        if (currentGroup.length > 0) {
          blockGroups.push(currentGroup);
        }

        // Compute block bounding boxes and text
        const blocks: TextBlock[] = [];
        const blockTexts: string[] = [];

        for (const group of blockGroups) {
          let bMinX = Infinity;
          let bMaxX = -Infinity;
          let bMinY = Infinity;
          let bMaxY = -Infinity;
          const texts: string[] = [];

          for (const line of group) {
            if (line.text.trim()) {
              bMinX = Math.min(bMinX, line.minX);
              bMaxX = Math.max(bMaxX, line.maxX);
              bMinY = Math.min(bMinY, line.y - 2);
              bMaxY = Math.max(bMaxY, line.y + line.height + 2);
            }
            texts.push(line.text);
          }

          if (bMinX !== Infinity) {
            blocks.push({
              minX: bMinX,
              maxX: bMaxX,
              minY: bMinY,
              maxY: bMaxY,
            });
            blockTexts.push(texts.join("\n"));
          }
        }

        pageLayouts.push({ lineRects, blocks });

        const pageText = blockTexts.join(`\n${BLOCK_MARKER}\n`);
        const marker = pageIndex > 1 ? `\n${PAGE_MARKER}\n` : "";
        return marker + pageText;
      });
    },
  };

  const data = await pdfParse(buffer, options);

  return {
    content: data.text,
    fileType: "pdf",
    originalName: fileName,
    pdfMeta: {
      pageCount: data.numpages,
      pageSizes,
      pageLayouts,
    },
  };
}

function parseXlsx(buffer: Buffer, fileName: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }

  return {
    content: sheets.join("\n\n"),
    fileType: "csv",
    originalName: fileName,
  };
}

/**
 * Creates a PDF with only translated text (no background).
 * Text is positioned block-by-block to match the original layout.
 * pdfkit handles all font rendering reliably.
 */
function createTextOnlyPdf(
  translatedContent: string,
  pageSizes: { width: number; height: number }[],
  pageLayouts: PageLayout[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const fontPath = path.join(process.cwd(), "fonts", "DejaVuSans.ttf");
    const hasFont = fs.existsSync(fontPath);
    const pageCount = Math.max(pageSizes.length, 1);
    const firstSize = pageSizes[0] || { width: 595, height: 842 };

    const doc = new PDFKitDoc({
      size: [firstSize.width, firstSize.height],
      margin: 0,
      bufferPages: true,
    });

    if (hasFont) doc.font(fontPath);
    else doc.font("Helvetica");

    const chunks: Uint8Array[] = [];
    doc.on("data", (c: Uint8Array) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Pre-create all pages matching original dimensions
    for (let i = 1; i < pageCount; i++) {
      const size = pageSizes[i] || firstSize;
      doc.addPage({ size: [size.width, size.height], margin: 0 });
    }

    // Split content by pages, then by blocks within each page
    const textPages = translatedContent.split(PAGE_MARKER);

    for (let i = 0; i < pageCount && i < textPages.length; i++) {
      const pageText = textPages[i].trim();
      if (!pageText) continue;

      doc.switchToPage(i);

      const size = pageSizes[i] || firstSize;
      const layout = pageLayouts[i];
      const translatedBlocks = pageText
        .split(BLOCK_MARKER)
        .map((b) => b.trim());

      if (layout && layout.blocks.length > 0) {
        const blockCount = Math.min(
          translatedBlocks.length,
          layout.blocks.length
        );

        for (let b = 0; b < blockCount; b++) {
          const block = layout.blocks[b];
          const blockText = translatedBlocks[b];
          if (!blockText) continue;

          const pad = 5;
          // PDF coords (bottom-left origin) → pdfkit coords (top-left origin)
          const textX = block.minX + pad;
          const textY = size.height - block.maxY + pad;
          const textWidth = block.maxX - block.minX - pad * 2;
          const textHeight = block.maxY - block.minY - pad * 2;

          doc
            .fontSize(9.5)
            .fillColor("#111111")
            .text(blockText, textX, textY, {
              width: Math.max(textWidth, 80),
              height: Math.max(textHeight, 30),
              align: "left",
              lineGap: 2.5,
            });
        }

        // Any extra translated blocks that don't have a layout match —
        // append below the last known block.
        if (translatedBlocks.length > layout.blocks.length) {
          const last = layout.blocks[layout.blocks.length - 1];
          const extra = translatedBlocks.slice(layout.blocks.length).join("\n");
          const textX = last.minX + 5;
          const textY = size.height - last.minY + 10;
          doc.fontSize(9.5).fillColor("#111111").text(extra, textX, textY, {
            width: last.maxX - last.minX - 10,
            align: "left",
            lineGap: 2.5,
          });
        }
      } else {
        // No layout info — fall back to full-page text
        doc.fontSize(9.5).fillColor("#111111").text(pageText, 50, 50, {
          width: size.width - 100,
          height: size.height - 100,
          align: "left",
          lineGap: 2.5,
        });
      }
    }

    doc.end();
  });
}

/**
 * Builds the final translated PDF:
 * 1. Loads the original PDF (preserving images, vectors, graphics)
 * 2. Draws white rectangles over individual text lines (images between
 *    text blocks stay untouched)
 * 3. Overlays the pdfkit-rendered translated text, placed block-by-block
 */
async function buildPdfOverlay(
  translatedContent: string,
  originalBuffer: Buffer,
  pageSizes: { width: number; height: number }[],
  pageLayouts: PageLayout[]
): Promise<Buffer> {
  const textPdfBuffer = await createTextOnlyPdf(
    translatedContent,
    pageSizes,
    pageLayouts
  );

  const pdfDoc = await PDFDocument.load(originalBuffer, {
    ignoreEncryption: true,
  });
  const textPdf = await PDFDocument.load(textPdfBuffer);

  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const layout = pageLayouts[i];

    // White-out each text line individually — images in the gaps survive
    if (layout) {
      const pad = 4;
      for (const rect of layout.lineRects) {
        page.drawRectangle({
          x: Math.max(0, rect.x - pad),
          y: Math.max(0, rect.y - pad),
          width: Math.min(width, rect.width + pad * 2),
          height: rect.height + pad * 2,
          color: rgb(1, 1, 1),
        });
      }
    }

    // Overlay the pdfkit text page (transparent background — only text draws)
    if (i < textPdf.getPageCount()) {
      const [embeddedPage] = await pdfDoc.embedPdf(textPdf, [i]);
      page.drawPage(embeddedPage, { x: 0, y: 0, width, height });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function buildTranslatedFile(
  translatedContent: string,
  originalFileType: string,
  targetLangCode: string,
  originalName: string,
  pdfMeta?: {
    pageCount: number;
    pageSizes: { width: number; height: number }[];
    pageLayouts: PageLayout[];
  },
  originalBuffer?: Buffer
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const nameParts = originalName.split(".");
  const ext = nameParts.pop();
  const baseName = nameParts.join(".");

  if (originalFileType === "pdf" && originalBuffer) {
    const pageSizes = pdfMeta?.pageSizes || [{ width: 595, height: 842 }];
    const pageLayouts = pdfMeta?.pageLayouts || [];
    const pdfBuffer = await buildPdfOverlay(
      translatedContent,
      originalBuffer,
      pageSizes,
      pageLayouts
    );
    return {
      buffer: pdfBuffer,
      fileName: `${baseName}_${targetLangCode}.pdf`,
      mimeType: "application/pdf",
    };
  }

  if (originalFileType === "csv" && (ext === "xlsx" || ext === "xls")) {
    const lines = translatedContent.split("\n");
    const sheetData: string[][] = [];
    for (const line of lines) {
      if (line.startsWith("=== Sheet:")) continue;
      if (line.trim() === "") continue;
      sheetData.push(line.split(","));
    }
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Translated");
    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return {
      buffer: Buffer.from(xlsxBuffer),
      fileName: `${baseName}_${targetLangCode}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  if (originalFileType === "html") {
    const newFileName =
      `${baseName}_${targetLangCode}.${ext}`.endsWith(".html") ||
      `${baseName}_${targetLangCode}.${ext}`.endsWith(".htm")
        ? `${baseName}_${targetLangCode}.${ext}`
        : `${baseName}_${targetLangCode}.html`;
    return {
      buffer: Buffer.from(translatedContent, "utf-8"),
      fileName: newFileName,
      mimeType: "text/html",
    };
  }

  return {
    buffer: Buffer.from(translatedContent, "utf-8"),
    fileName: `${baseName}_${targetLangCode}.txt`,
    mimeType: "text/plain",
  };
}
