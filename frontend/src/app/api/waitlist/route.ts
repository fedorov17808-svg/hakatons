import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { applyRateLimit, sanitizeString, sanitizeEmail, safeErrorResponse } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

// Vercel's serverless functions have a read-only filesystem outside /tmp — process.cwd()
// is not writable in production and every submission would 500. /tmp is writable but is
// NOT durable across cold starts or separate instances, so every submission is also
// logged to stdout (visible via `vercel logs`) as a backstop until this moves to a real
// datastore (Vercel KV/Postgres).
const WAITLIST_FILE = path.join("/tmp", "creditpulse_waitlist_submissions.json");

// Max submissions to prevent disk abuse
const MAX_SUBMISSIONS = 10_000;

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 req/min to prevent spam
    const rateLimitResponse = applyRateLimit(req, 5, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();

    // Validate & sanitize all inputs
    const email = sanitizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const name = sanitizeString(body.name, 100) || "Anonymous";
    const organization = sanitizeString(body.organization, 200) || "DeFi / Institutional Credit Protocol";
    const protocolType = sanitizeString(body.protocolType, 100) || "Lending / RWA";
    const monthlyLoanVolume = sanitizeString(body.monthlyLoanVolume, 50) || "$1M - $10M";
    const notes = sanitizeString(body.notes, 500) || "";

    const submission = {
      id: "WL-" + Date.now().toString(36).toUpperCase(),
      name,
      email,
      organization,
      protocolType,
      monthlyLoanVolume,
      notes,
      timestamp: new Date().toISOString(),
    };

    let list: Array<Record<string, unknown>> = [];
    if (fs.existsSync(WAITLIST_FILE)) {
      try {
        const raw = fs.readFileSync(WAITLIST_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = [];
      }
    }

    // Check for duplicate email
    if (list.some((s) => s.email === email)) {
      return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
    }

    // Prevent disk abuse
    if (list.length >= MAX_SUBMISSIONS) {
      return NextResponse.json({ error: "Waitlist is currently full" }, { status: 503 });
    }

    list.push(submission);
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2), "utf8");
    console.log("[waitlist] new submission", JSON.stringify(submission));

    return NextResponse.json({
      success: true,
      message: "Successfully registered for CreditPulse AI Institutional Early Access & LOI Partner Program",
      submissionId: submission.id,
    });
  } catch (err) {
    return safeErrorResponse(err, 500, "Registration failed. Please try again.");
  }
}

// Public: aggregate count only. Individual submissions (org, protocol type, contact
// info) are business-sensitive and were previously exposed to any caller — this route
// is unauthenticated, so it must never return per-entry data.
export async function GET(req: Request) {
  const rateLimitResponse = applyRateLimit(req, 30, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  let list: Array<Record<string, string>> = [];
  if (fs.existsSync(WAITLIST_FILE)) {
    try {
      const raw = fs.readFileSync(WAITLIST_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  return NextResponse.json({
    total_waitlist_count: list.length,
  });
}
