/** GTIN / UPC / EAN helpers used for catalog match and remote identification. */

export function digitsOnly(code: string) {
  return (code || "").replace(/\D/g, "");
}

export function isGtin(code: string) {
  const digits = digitsOnly(code);
  return digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14;
}

function gtinCheckDigit(body: string) {
  let sum = 0;
  const chars = body.split("").reverse();
  for (let i = 0; i < chars.length; i += 1) {
    const n = Number(chars[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return String((10 - (sum % 10)) % 10);
}

export function withGtinCheckDigit(body: string) {
  const digits = digitsOnly(body);
  if (!digits) return "";
  return `${digits}${gtinCheckDigit(digits)}`;
}

export function expandUpcE(code: string) {
  const digits = digitsOnly(code);
  if (digits.length !== 6 && digits.length !== 8) return "";
  const core = digits.length === 8 ? digits.slice(1, 7) : digits;
  const numberSystem = digits.length === 8 ? digits[0] : "0";
  const last = core[5];
  let manufacturer = "";
  let item = "";
  if (last === "0" || last === "1" || last === "2") {
    manufacturer = core.slice(0, 2) + last + "00";
    item = "00" + core.slice(2, 5);
  } else if (last === "3") {
    manufacturer = core.slice(0, 3) + "00";
    item = "000" + core.slice(3, 5);
  } else if (last === "4") {
    manufacturer = core.slice(0, 4) + "0";
    item = "0000" + core[4];
  } else {
    manufacturer = core.slice(0, 5);
    item = "0000" + last;
  }
  return withGtinCheckDigit(`${numberSystem}${manufacturer}${item}`);
}

export function barcodeVariants(code: string) {
  const raw = (code || "").trim();
  if (!raw) return [];
  const variants = new Set<string>([raw, raw.toUpperCase()]);
  const compact = raw.replace(/[\s-]/g, "");
  if (compact) {
    variants.add(compact);
    variants.add(compact.toUpperCase());
  }
  const digits = digitsOnly(raw);
  if (digits) {
    variants.add(digits);
    variants.add(digits.replace(/^0+/, "") || "0");
    if (digits.length === 12) variants.add(`0${digits}`);
    if (digits.length === 13 && digits.startsWith("0")) variants.add(digits.slice(1));
    if (digits.length === 14) {
      variants.add(digits.slice(1));
      if (digits.startsWith("00")) variants.add(digits.slice(2));
    }
    if (digits.length === 6 || digits.length === 8) {
      const upcA = expandUpcE(digits);
      if (upcA) {
        variants.add(upcA);
        if (upcA.length === 12) variants.add(`0${upcA}`);
      }
    }
  }
  return Array.from(variants).filter(Boolean);
}

export function codesMatch(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false;
  if (left.trim() === right.trim()) return true;
  const rightSet = new Set(barcodeVariants(right));
  return barcodeVariants(left).some((value) => rightSet.has(value));
}
