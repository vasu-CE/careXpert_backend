import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { RateLimiter } from 'limiter';

// Rate limiting: 5 requests per second
const aiRateLimiter = new RateLimiter({
  tokensPerInterval: 5,
  interval: 'second'
});

// AI Service Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY as string);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
});

// In-memory cache for storing analysis results
const analysisCache = new Map<string, ReportAnalysis>();

// Type Definitions
export interface AbnormalValue {
  term: string;
  value: string;
  normal_range: string;
  issue: string;
}

export interface ReportAnalysis {
  summary: string;
  abnormal_values: AbnormalValue[];
  possible_conditions: string[];
  recommendation: string;
  disclaimer: string;
}

// Custom Error Class
class AIAnalysisError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AIAnalysisError';
  }
}

// Generates a simple hash for caching
function generateTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Analyzes medical report text using Gemini AI
 * @param text The extracted text from the medical report
 * @param useCache Whether to use cached results
 * @returns Promise resolving to the analysis result
 */
export const analyzeReport = async (text: string, useCache: boolean = true): Promise<ReportAnalysis> => {
  if (!text?.trim()) {
    throw new AIAnalysisError('No text provided for analysis', 400);
  }

  const cacheKey = generateTextHash(text);

  if (useCache && analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)!;
  }

  try {
    // Apply rate limiting
    await aiRateLimiter.removeTokens(1);

    const prompt = `
You are an advanced medical report analysis assistant. You will receive text extracted from laboratory medical reports. Your task is to interpret the report, detect abnormal results, explain possible causes, and give appropriate recommendations.

⚙ INPUT
The input may include:
- Medical test names, units, reference ranges, and results.
- Qualitative results like "Reactive", "Non-Reactive", "Positive", "Negative".
- Notes about test methods, limitations, or interpretations.
- Missing values, incomplete or noisy data.
- Multiple tests in one report.

📦 OUTPUT FORMAT
You MUST respond only in the following JSON format:

{
  "summary": "A brief interpretation of the report results, highlighting key findings.",
  "abnormal_values": [
    {
      "term": "Test name",
      "value": "Test result value",
      "normal_range": "Reference range or expected values",
      "issue": "Explanation of the abnormality or result"
    }
  ],
  "possible_conditions": ["List of medical conditions associated with abnormalities"],
  "recommendation": "Advice for the patient on next steps or further evaluation",
  "disclaimer": "A disclaimer stating that this is not a substitute for professional medical advice."
}

✅ Every field must always be present:
- Use empty arrays or empty strings if no abnormalities are found or unknown.
- Provide results even if incomplete but explain that information is missing.
`;

    const chat = model.startChat({
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    });

    const result = await chat.sendMessage([
      { text: `${prompt}\n\nMedical Report Text:\n${text}` }
    ]);
    

    const response = await result.response;
    const responseText = await response.text();

    if (!responseText) {
      throw new AIAnalysisError('Empty response from Gemini API', 502, true);
    }

    // Extract JSON from possible markdown formatting
    let jsonResponse = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonResponse = jsonMatch[1];
    }

    let analysis: ReportAnalysis;
    try {
      analysis = JSON.parse(jsonResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', jsonResponse);
      throw new AIAnalysisError('Invalid JSON response from Gemini API', 502, true);
    }

    if (!isValidAnalysis(analysis)) {
      console.error('Invalid analysis structure:', analysis);
      throw new AIAnalysisError('Invalid analysis structure from Gemini API', 502, true);
    }

    // Cache the result
    analysisCache.set(cacheKey, analysis);

    // Limit cache size
    if (analysisCache.size > 100) {
      const firstKey = analysisCache.keys().next().value;
      if (firstKey !== undefined) {
        analysisCache.delete(firstKey);
      }
    }
    

    return analysis;
  } catch (error) {
    console.error('Error in analyzeReport:', error);
    if (error instanceof AIAnalysisError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis';
    throw new AIAnalysisError(`AI analysis failed: ${errorMessage}`, 500, true);
  }
};

/**
 * Validates that the analysis conforms to the expected structure
 */
function isValidAnalysis(analysis: any): analysis is ReportAnalysis {
  return (
    analysis &&
    typeof analysis === 'object' &&
    typeof analysis.summary === 'string' &&
    Array.isArray(analysis.abnormal_values) &&
    Array.isArray(analysis.possible_conditions) &&
    typeof analysis.recommendation === 'string' &&
    typeof analysis.disclaimer === 'string'
  );
}

/**
 * Clears the analysis cache
 */
export const clearAnalysisCache = (): void => {
  analysisCache.clear();
};
