import { createHash } from "node:crypto";

export function tokenLookup(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
