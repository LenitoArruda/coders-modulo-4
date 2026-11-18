import { NextResponse, type NextRequest } from "next/server";

import {
  fetchApiWithSession,
  getApiBaseUrl,
  getBearerToken,
} from "../../../../../lib/auth/api-client";

/** Proxies a ready file through an authenticated web route; bytes never sit in JS. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
): Promise<Response> {
  const token = await getBearerToken();

  if (token === null) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in to download this file." },
      { status: 401 },
    );
  }

  const { mediaId } = await params;
  const apiUrl = new URL(
    `/api/v1/media/${encodeURIComponent(mediaId)}/content`,
    getApiBaseUrl(),
  );

  let apiResponse: Response;

  try {
    apiResponse = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { code: "DOWNLOAD_FAILED", message: "The download failed. Try again." },
      { status: 502 },
    );
  }

  if (!apiResponse.ok || apiResponse.body === null) {
    return NextResponse.json(
      { code: "MEDIA_NOT_FOUND", message: "That file is no longer available." },
      { status: apiResponse.status === 404 ? 404 : 502 },
    );
  }

  const headers = new Headers();
  const inline = request.nextUrl.searchParams.get("inline") === "1";

  for (const name of [
    "content-type",
    "content-disposition",
    "content-length",
    "cache-control",
    "x-content-type-options",
  ]) {
    const value = apiResponse.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  if (inline) {
    const disposition = headers.get("content-disposition") ?? "";
    const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "media";

    headers.set("content-disposition", `inline; filename="${fileName}"`);
  }

  return new Response(apiResponse.body, { status: 200, headers });
}
