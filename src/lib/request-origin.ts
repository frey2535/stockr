export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) url.host = host.split(",")[0].trim();
  if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1";
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) url.protocol = `${proto.split(",")[0].trim()}:`;
  return url;
}

export function isFormRequest(request: Request) {
  const type = request.headers.get("content-type") || "";
  return (
    type.includes("application/x-www-form-urlencoded") ||
    type.includes("multipart/form-data")
  );
}
