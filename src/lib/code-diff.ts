/**
 * Dependency-free line diff for the Version Diff Viewer.
 *
 * Classic LCS (longest common subsequence) over lines. Generated code files
 * are a few hundred lines, so the O(n*m) table is well within budget and we
 * skip pulling in a diff dependency for one feature.
 */

export type DiffOp = "same" | "add" | "del";

export interface DiffRow {
  type: DiffOp;
  /** 1-based line number in the OLD text (undefined for additions). */
  oldLine?: number;
  /** 1-based line number in the NEW text (undefined for deletions). */
  newLine?: number;
  text: string;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function diffLines(oldText: string, newText: string): DiffRow[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const n = a.length;
  const m = b.length;

  // LCS length table. lcs[i][j] = LCS of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Walk the table emitting rows. Prefer deletions before additions so hunks
  // read as "old lines out, new lines in".
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "same", oldLine: i + 1, newLine: j + 1, text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: "del", oldLine: i + 1, text: a[i] });
      i++;
    } else {
      rows.push({ type: "add", newLine: j + 1, text: b[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", oldLine: i + 1, text: a[i] });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", newLine: j + 1, text: b[j] });
    j++;
  }
  return rows;
}

export function diffStats(rows: DiffRow[]): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, unchanged: 0 };
  for (const row of rows) {
    if (row.type === "add") stats.added++;
    else if (row.type === "del") stats.removed++;
    else stats.unchanged++;
  }
  return stats;
}

/**
 * Collapse long runs of unchanged lines to keep the diff readable, leaving
 * `context` lines around every change. Collapsed runs become a single marker
 * row (type "same" with text set to the skip notice) — callers can style it
 * via the `collapsed` flag.
 */
export interface DisplayRow extends DiffRow {
  collapsed?: boolean;
  collapsedCount?: number;
}

export function collapseUnchanged(rows: DiffRow[], context = 3): DisplayRow[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((row, idx) => {
    if (row.type === "same") return;
    for (
      let k = Math.max(0, idx - context);
      k <= Math.min(rows.length - 1, idx + context);
      k++
    ) {
      keep[k] = true;
    }
  });

  const out: DisplayRow[] = [];
  let skipRun = 0;
  const flush = () => {
    if (skipRun > 0) {
      out.push({
        type: "same",
        text: `${skipRun} unchanged lines`,
        collapsed: true,
        collapsedCount: skipRun,
      });
      skipRun = 0;
    }
  };
  rows.forEach((row, idx) => {
    if (keep[idx] || row.type !== "same") {
      flush();
      out.push(row);
    } else {
      skipRun++;
    }
  });
  flush();
  return out;
}
