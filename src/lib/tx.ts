import type { TxType } from "./types";

export const TX_TYPES: TxType[] = [
  "use",
  "return",
  "receive",
  "transfer",
  "add",
  "count",
  "adjust",
  "shrink",
];

export function needsFrom(type: TxType) {
  return type === "use" || type === "shrink" || type === "transfer";
}

export function needsTo(type: TxType) {
  return (
    type === "add" ||
    type === "receive" ||
    type === "return" ||
    type === "transfer" ||
    type === "adjust" ||
    type === "count"
  );
}

export function needsProject(type: TxType) {
  return type === "use" || type === "return";
}

export function actionVerb(type: TxType) {
  switch (type) {
    case "add":
      return "Added";
    case "receive":
      return "Received";
    case "return":
      return "Returned";
    case "transfer":
      return "Transferred";
    case "use":
      return "Used";
    case "count":
      return "Counted";
    case "adjust":
      return "Adjusted";
    case "shrink":
      return "Recorded shrinkage for";
    default:
      return "Updated";
  }
}
