export function buildrProjectPaths(companyId: string) {
  const id = encodeURIComponent(companyId.trim());
  return [`/companies/${id}/projects`, `/stockr/projects?company_id=${id}`, "/projects"];
}

export function preferBuildrError(prev: string, next: string) {
  if (/auth_required|API key|service token|login token|session_expired|stockr_secret|company_not_found/i.test(prev) && /website instead/i.test(next)) {
    return prev;
  }
  return next || prev;
}
