import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/sheets?id=SPREADSHEET_ID&sheet=Sheet1
 *
 * Reads rows from a Google Sheet via the Sheets API.
 * Uses a service account for auth (GOOGLE_SERVICE_ACCOUNT_KEY env var).
 *
 * For now, returns a placeholder until Google Sheets API is configured.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("id");
  const sheetName = searchParams.get("sheet") || "Sheet1";

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Missing 'id' parameter" },
      { status: 400 },
    );
  }

  // Check if Google service account is configured
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    return NextResponse.json(
      {
        error: "Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY in .env.local",
        hint: "Create a service account at console.cloud.google.com, enable Sheets API, and paste the JSON key.",
      },
      { status: 503 },
    );
  }

  try {
    // Parse service account credentials
    const credentials = JSON.parse(serviceAccountKey);

    // Use Google Sheets API v4 directly via fetch (no googleapis dependency needed)
    const token = await getAccessToken(credentials);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Sheets API error: ${res.status}`, details: body },
        { status: res.status },
      );
    }

    const data = await res.json();
    const values: string[][] = data.values ?? [];

    if (values.length === 0) {
      return NextResponse.json([]);
    }

    // First row = headers, rest = data rows
    const headers = values[0]!;
    const rows = values.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]!] = row[i] ?? "";
      }
      return obj;
    });

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read sheet" },
      { status: 500 },
    );
  }
}

/**
 * Get an OAuth2 access token from a service account using JWT.
 * This avoids needing the full googleapis library.
 */
async function getAccessToken(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Create JWT
  const { createSign } = await import("node:crypto");

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signable = `${encodedHeader}.${encodedPayload}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signable);
  const signature = sign.sign(credentials.private_key, "base64url");

  const jwt = `${signable}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function base64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
