const ALLOWED_HOSTS = new Set([
  "api.openfigi.com",
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function isAllowedTarget(target) {
  try {
    const { hostname } = new URL(target);
    return ALLOWED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

const worker = {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing ?url= parameter", {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    if (!isAllowedTarget(target)) {
      return new Response("Target host not allowed", {
        status: 403,
        headers: CORS_HEADERS,
      });
    }

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("origin");
    headers.delete("referer");

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  },
};

export default worker;
