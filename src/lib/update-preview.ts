export function wantsUpdatePreview(search: string) {
  return new URLSearchParams(search).get("update_now") === "1";
}
