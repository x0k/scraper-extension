import type { CompareResult } from "@/lib/ord";

export type JSONPrimitive = string | number | boolean;

export type JSONPrimitiveLiterals = "string" | "number" | "boolean";

export type JSONRecord = { [k: string]: JSONValue };

export type JSONArray = JSONValue[];

export type JSONObject = JSONRecord | JSONArray;

export type JSONValue = JSONPrimitive | null | JSONObject;

export const isJsonPrimitive = (value: JSONValue): value is JSONPrimitive =>
  typeof value !== "object";

const primitiveTypeOrder: Record<JSONPrimitiveLiterals, 0 | 1 | 2> = {
  boolean: 0,
  number: 1,
  string: 2,
};

type CmpRow = [CompareResult, CompareResult, CompareResult];

const cmpTable: [CmpRow, CmpRow, CmpRow] = [
  [0, -1, -1],
  [1, 0, -1],
  [1, 1, 0],
];

export function compareSameTypeJsonPrimitive<T extends JSONPrimitive>(
  a: T,
  b: T
): CompareResult {
  return a > b ? 1 : a < b ? -1 : 0;
}

export function compareJsonPrimitive(
  a: JSONPrimitive,
  b: JSONPrimitive
): CompareResult {
  if (a === b) {
    return 0;
  }
  const ta = typeof a as JSONPrimitiveLiterals;
  const tb = typeof b as JSONPrimitiveLiterals;
  return ta === tb
    ? compareSameTypeJsonPrimitive(a, b)
    : cmpTable[primitiveTypeOrder[ta]][primitiveTypeOrder[tb]];
}

export function compareJsonArray(a: JSONArray, b: JSONArray): CompareResult {
  if (a.length < b.length) {
    return -1;
  }
  if (a.length > b.length) {
    return 1;
  }
  const len = a.length;
  let i = 0;
  while (i < len) {
    const result = compareJsonValue(a[i], b[i]);
    if (result !== 0) {
      return result;
    }
    i++;
  }
  return 0;
}

export function compareJsonRecords(
  a: JSONRecord,
  b: JSONRecord
): CompareResult {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const result = compareSameTypeJsonPrimitive(aKeys.length, bKeys.length);
  if (result !== 0) {
    return result;
  }
  let aMaxMissingKey = "";
  let bMaxMissingKey = "";
  const commonKeys: string[] = []
  for (let i = 0; i < aKeys.length; i++) {
    const aKey = aKeys[i];
    if (aKey in b) {
      commonKeys.push(aKey);
    } else if (aKey > aMaxMissingKey) {
      aMaxMissingKey = aKey;
    }
    const bKey = bKeys[i];
    if (!(bKey in a) && bKey > bMaxMissingKey) {
      bMaxMissingKey = bKey;
    }
  }
  const diff = compareSameTypeJsonPrimitive(aMaxMissingKey, bMaxMissingKey);
  if (diff !== 0) {
    return diff;
  }
  commonKeys.sort()
  for (let i = 0; i < commonKeys.length; i++) {
    const key = commonKeys[i];
    const result = compareJsonValue(a[key], b[key]);
    if (result !== 0) {
      return result;
    }
  }
  return 0
}

export function compareJsonObjects(
  a: JSONObject,
  b: JSONObject
): CompareResult {
  if (Array.isArray(a)) {
    return Array.isArray(b) ? compareJsonArray(a, b) : -1;
  }
  return Array.isArray(b) ? 1 : compareJsonRecords(a, b);
}

export function compareJsonValue(a: JSONValue, b: JSONValue): CompareResult {
  if (a === null) {
    if (b === null) {
      return 0;
    }
    return -1;
  }
  if (b === null) {
    return 1;
  }
  if (isJsonPrimitive(a)) {
    return isJsonPrimitive(b) ? compareJsonPrimitive(a, b) : -1;
  }
  return isJsonPrimitive(b) ? 1 : compareJsonObjects(a, b);
}
