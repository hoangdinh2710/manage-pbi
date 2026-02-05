import { ReplacementRule, UploadedFile, RunResult } from "../types";

const CSV_ROW_SPLIT = /\r?\n/;

const splitCsvRow = (row: string): string[] => row.split(",");

export const parseCsvPreview = (content: string, maxRows = 6): string[][] => {
  if (!content) {
    return [];
  }

  return content
    .trim()
    .split(CSV_ROW_SPLIT)
    .slice(0, maxRows)
    .map((row) => splitCsvRow(row));
};

export const extractColumns = (content: string): string[] => {
  const [header] = content.split(CSV_ROW_SPLIT);
  if (!header) {
    return [];
  }
  return splitCsvRow(header).map((value) => value.trim());
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceWithCount = (
  input: string,
  keyword: string,
  replacement: string,
  caseSensitive: boolean
): { nextValue: string; count: number } => {
  if (!keyword) {
    return { nextValue: input, count: 0 };
  }

  const flags = caseSensitive ? "g" : "gi";
  const matcher = new RegExp(escapeRegExp(keyword), flags);
  let count = 0;
  const nextValue = input.replace(matcher, (match) => {
    count += 1;
    return replacement;
  });

  return { nextValue, count };
};

interface ApplyOutput {
  updatedRows: string[];
  replacements: number;
}

const applyRulesToRows = (
  rows: string[],
  rules: ReplacementRule[]
): ApplyOutput => {
  if (!rules.length) {
    return { updatedRows: rows, replacements: 0 };
  }

  if (!rows.length) {
    return { updatedRows: rows, replacements: 0 };
  }

  const header = splitCsvRow(rows[0]);
  const dataRows = rows.slice(1).map((row) => splitCsvRow(row));

  let totalReplacements = 0;

  const updatedData = dataRows.map((cells) => {
    const nextCells = [...cells];

    rules.forEach((rule) => {
      if (!rule.keyword) {
        return;
      }

      const targetColumns = rule.columns.length ? rule.columns : header;
      const indexes = targetColumns
        .map((column) => header.findIndex((value) => value === column))
        .filter((index) => index !== -1);

      indexes.forEach((columnIndex) => {
        const currentValue = nextCells[columnIndex] ?? "";
        const { nextValue, count } = replaceWithCount(
          currentValue,
          rule.keyword,
          rule.replacement,
          rule.caseSensitive
        );
        nextCells[columnIndex] = nextValue;
        totalReplacements += count;
      });
    });

    return nextCells;
  });

  const rebuiltRows = [header, ...updatedData].map((row) => row.join(","));

  return {
    updatedRows: rebuiltRows,
    replacements: totalReplacements
  };
};

export const runRulesAgainstFile = (
  file: UploadedFile,
  rules: ReplacementRule[]
): RunResult => {
  const rows = file.content.split(CSV_ROW_SPLIT).filter((row) => row.length);
  const { updatedRows, replacements } = applyRulesToRows(rows, rules);
  const updatedContent = updatedRows.join("\n");

  const previewBefore = parseCsvPreview(file.content);
  const previewAfter = parseCsvPreview(updatedContent);

  return {
    fileId: file.id,
    fileName: file.name,
    applied: true,
    replacements,
    updatedContent,
    previewBefore,
    previewAfter
  };
};

export const summarizeReplacements = (results: RunResult[]): number =>
  results.reduce((total, result) => total + (result.applied ? result.replacements : 0), 0);
