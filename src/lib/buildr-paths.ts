export function buildrProjectPaths(companyId: string) {
  const id = encodeURIComponent(companyId.trim());
  return [`/stockr/projects?company_id=${id}`, "/projects"];
}

export function preferBuildrError(prev: string, next: string) {
  if (/auth_required|API key|service token|session_expired|stockr_secret/i.test(prev) && /website instead/i.test(next)) {
    return prev;
  }
  return next || prev;
}
