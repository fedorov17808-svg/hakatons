/**
 * CreditPulse API Security Middleware
 * 
 * Unified security layer for all API routes:
 * - Rate limiting (per-IP sliding window)
 * - Input validation (EVM address, sanitization)
 * - Error sanitization (no stack traces in production)
 * - Request size limits
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "./rateLimiter";

// ==========================================
// 1. EVM Address Validation
// ==========================================

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validate an EVM address string.
 * Returns the checksummed address or null if invalid.
 */
export function validateAddress(address: unknown): string | null {
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  if (!EVM_ADDRESS_REGEX.test(trimmed)) return null;
  return trimmed; // Valid hex address
}

// ==========================================
// 2. Input Sanitization
// ==========================================

/**
 * Sanitize a string input: trim, strip control chars, limit length.
 * Prevents path traversal, XSS payload injection, and oversized inputs.
 */
export function sanitizeString(input: unknown, maxLength: number = 500): string {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, "") // Strip control characters
    .replace(/<[^>]*>/g, "")          // Strip HTML tags
    .replace(/\.\.\//g, "")           // Strip path traversal
    .slice(0, maxLength);
}

/**
 * Sanitize an email address.
 */
export function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  // RFC 5322 simplified email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(trimmed) || trimmed.length > 254) return null;
  return trimmed;
}

// ==========================================
// 3. Error Sanitization
// ==========================================

/**
 * Create a safe error response that never leaks stack traces or internal paths.
 */
export function safeErrorResponse(
  error: unknown,
  statusCode: number = 500,
  publicMessage: string = "Internal server error"
): NextResponse {
  // Log full error server-side for debugging
  console.error("[API Error]", error);

  // Never expose internal details to clients
  const isDev = process.env.NODE_ENV === "development";
  const message = isDev && error instanceof Error
    ? error.message
    : publicMessage;

  return NextResponse.json(
    { error: message, success: false },
    { status: statusCode }
  );
}

// ==========================================
// 4. Rate Limit Guard (reusable wrapper)
// ==========================================

/**
 * Apply rate limiting to a request. Returns a 429 response if exceeded, null if allowed.
 * @param req - The incoming request
 * @param maxRequests - Max requests per window (default: 30)
 * @param windowMs - Window in ms (default: 60s)
 */
export function applyRateLimit(
  req: Request,
  maxRequests: number = 30,
  windowMs: number = 60_000
): NextResponse | null {
  const ip = getClientIP(req);
  const result = checkRateLimit(ip, maxRequests, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please try again later.",
        retryAfterMs: result.retryAfterMs,
        success: false,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.retryAfterMs || 60000) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null; // Allowed
}

// ==========================================
// 5. Request Body Validation
// ==========================================

/**
 * Safely parse JSON body with size limit.
 * Returns parsed object or null (with error response).
 */
export async function parseJsonBody(
  req: Request,
  maxSizeBytes: number = 100_000
): Promise<{ data: Record<string, unknown> | null; error: NextResponse | null }> {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return {
        data: null,
        error: NextResponse.json(
          { error: "Request body too large", success: false },
          { status: 413 }
        ),
      };
    }

    const text = await req.text();
    if (text.length > maxSizeBytes) {
      return {
        data: null,
        error: NextResponse.json(
          { error: "Request body too large", success: false },
          { status: 413 }
        ),
      };
    }

    const data = JSON.parse(text);
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Invalid JSON body", success: false },
        { status: 400 }
      ),
    };
  }
}
