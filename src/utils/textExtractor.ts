import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { fromBuffer } from "pdf2pic";

// Note: Using any[] type for pdf2pic results to avoid complex type definitions

// Type declarations
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        // Extend here only if you have additional properties
      }
    }
  }
}

export interface TextExtractionResult {
  text: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Downloads a file from a URL and returns it as a Buffer
 * @param url URL to download the file from
 * @returns Promise that resolves to the file buffer
 */
async function downloadFileFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`Failed to download file: HTTP ${response.statusCode}`)
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Extracts text from a file (PDF or image) - supports both local files and Cloudinary URLs
 * @param filePath Path to the file to extract text from (local path or Cloudinary URL)
 * @returns Promise that resolves to the extracted text and file info
 */
export async function extractTextFromFile(
  filePath: string
): Promise<TextExtractionResult> {
  try {
    let fileBuffer: Buffer;
    let fileExt: string;

    // Check if it's a Cloudinary URL
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      console.log("Downloading file from Cloudinary URL:", filePath);
      fileBuffer = await downloadFileFromUrl(filePath);
      // Extract file extension from URL
      const urlPath = new URL(filePath).pathname;
      fileExt = path.extname(urlPath).toLowerCase();
    } else {
      // Local file
      fileBuffer = await fs.promises.readFile(filePath);
      fileExt = path.extname(filePath).toLowerCase();
    }

    const mimeType = getMimeType(fileExt);
    const fileSize = fileBuffer.length;

    if (fileExt === ".pdf") {
      try {
        const text = await extractTextFromPdf(fileBuffer);
        // If PDF text extraction returns empty or very short text, try OCR
        if (!text || text.trim().length < 10) {
          console.log(
            "PDF text extraction returned minimal text, trying OCR..."
          );
          const ocrText = await extractTextFromPdfAsImage(fileBuffer);
          return { text: ocrText, mimeType, fileSize };
        }
        return { text, mimeType, fileSize };
      } catch (pdfError) {
        console.log(
          "PDF text extraction failed, trying OCR fallback...",
          pdfError
        );
        // If PDF parsing fails, try OCR as fallback
        const ocrText = await extractTextFromPdfAsImage(fileBuffer);
        return { text: ocrText, mimeType, fileSize };
      }
    } else if ([".jpg", ".jpeg", ".png"].includes(fileExt)) {
      const text = await extractTextFromImage(fileBuffer);
      return { text, mimeType, fileSize };
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from file:", errorMessage);
    throw new Error(`Failed to extract text from file: ${errorMessage}`);
  }
}

/**
 * Extracts text from a PDF file using pdf-parse
 * @param pdfBuffer Buffer containing PDF data
 */
async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdf = await import("pdf-parse");
    const data = await pdf.default(pdfBuffer);
    return data.text;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from PDF:", errorMessage);
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Extracts text from a PDF by converting it to images and using OCR
 * @param pdfBuffer Buffer containing PDF data
 */
async function extractTextFromPdfAsImage(pdfBuffer: Buffer): Promise<string> {
  try {
    // Convert PDF to images
    const convert = fromBuffer(pdfBuffer, {
      density: 100, // DPI for better quality
      saveFilename: "page",
      savePath: "./temp",
      format: "png",
      width: 2000,
      height: 2000,
    });

    const results: any[] = await convert.bulk(-1); // Convert all pages
    let allText = "";

    // Process each page
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`Processing PDF page ${i + 1}/${results.length}`);

      // Check if result has a valid path
      if (!result || !result.path || typeof result.path !== "string") {
        console.warn(`Skipping page ${i + 1}: No valid path found`);
        continue;
      }

      // Read the converted image
      const imageBuffer = await fs.promises.readFile(result.path);

      // Extract text from the image using OCR
      const pageText = await extractTextFromImage(imageBuffer);
      allText += pageText + "\n";

      // Clean up the temporary image file
      try {
        await fs.promises.unlink(result.path);
      } catch (cleanupError) {
        console.warn(
          "Warning: Could not clean up temporary file:",
          cleanupError
        );
      }
    }

    return allText.trim();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from PDF as image:", errorMessage);
    throw new Error(
      `Failed to extract text from PDF as image: ${errorMessage}`
    );
  }
}

/**
 * Extracts text from an image using Tesseract.js
 * @param imageBuffer Buffer containing image data
 */
import { createWorker } from "tesseract.js";

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  let worker: any = null;
  try {
    // Create Tesseract worker for v6+ with language parameter
    worker = await createWorker("eng");

    // Recognize text from the image buffer
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);

    return text;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error extracting text from image:", errorMessage);
    throw new Error(`Failed to extract text from image: ${errorMessage}`);
  } finally {
    // Safely terminate the worker if it exists
    if (worker && typeof worker.terminate === "function") {
      try {
        await worker.terminate();
      } catch (terminateError) {
        console.warn("Error terminating Tesseract worker:", terminateError);
      }
    }
  }
}

/**
 * Returns MIME type based on file extension
 * @param ext File extension including the dot (e.g., '.pdf')
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };

  if (!mimeTypes[ext]) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  return mimeTypes[ext];
}

/**
 * Validates the file size and type
 * @param file Express Multer File object
 * @param maxSizeInBytes Maximum allowed file size in bytes (default: 10MB)
 */
export function validateFile(
  file: Express.Multer.File,
  maxSizeInBytes: number = 10 * 1024 * 1024
): void {
  if (file.size > maxSizeInBytes) {
    throw new Error(
      `File size exceeds the maximum allowed size of ${
        maxSizeInBytes / (1024 * 1024)
      } MB`
    );
  }

  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      `Unsupported file type: ${
        file.mimetype
      }. Allowed types: ${allowedMimeTypes.join(", ")}`
    );
  }
}
