import { describe, it, expect } from "vitest";
import {
  diffLines,
  diffStats,
  collapseUnchanged,
  type DiffRow,
} from "./code-diff";

describe("diffLines", () => {
  it("returns all-same rows for identical texts", () => {
    const rows = diffLines("a\nb\nc", "a\nb\nc");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.type === "same")).toBe(true);
  });

  it("handles empty old text as pure additions", () => {
    const rows = diffLines("", "a\nb");
    expect(rows.map((r) => r.type)).toEqual(["add", "add"]);
    expect(rows.map((r) => r.newLine)).toEqual([1, 2]);
  });

  it("handles empty new text as pure deletions", () => {
    const rows = diffLines("a\nb", "");
    expect(rows.map((r) => r.type)).toEqual(["del", "del"]);
    expect(rows.map((r) => r.oldLine)).toEqual([1, 2]);
  });

  it("detects a single changed line as del + add", () => {
    const rows = diffLines("a\nb\nc", "a\nX\nc");
    expect(rows.map((r) => r.type)).toEqual(["same", "del", "add", "same"]);
    expect(rows[1].text).toBe("b");
    expect(rows[2].text).toBe("X");
  });

  it("detects an inserted line", () => {
    const rows = diffLines("a\nc", "a\nb\nc");
    expect(rows.map((r) => r.type)).toEqual(["same", "add", "same"]);
    expect(rows[1].text).toBe("b");
  });

  it("normalizes CRLF so Windows line endings do not create phantom diffs", () => {
    const rows = diffLines("a\r\nb", "a\nb");
    expect(rows.every((r) => r.type === "same")).toBe(true);
  });

  it("tracks both line numbers on unchanged rows", () => {
    const rows = diffLines("x\na", "a");
    const same = rows.find((r) => r.type === "same");
    expect(same?.oldLine).toBe(2);
    expect(same?.newLine).toBe(1);
  });

  it("handles two empty strings", () => {
    expect(diffLines("", "")).toEqual([]);
  });
});

describe("diffStats", () => {
  it("counts adds, dels and unchanged", () => {
    const stats = diffStats(diffLines("a\nb\nc", "a\nX\nc\nd"));
    expect(stats).toEqual({ added: 2, removed: 1, unchanged: 2 });
  });
});

describe("collapseUnchanged", () => {
  const manySame = (n: number) =>
    Array.from({ length: n }, (_, i) => `line${i}`).join("\n");

  it("collapses long unchanged runs into a marker row", () => {
    const oldText = manySame(20);
    const newText = oldText + "\nEXTRA";
    const rows = collapseUnchanged(diffLines(oldText, newText), 3);
    const marker = rows.find((r) => r.collapsed);
    expect(marker).toBeDefined();
    // 20 same lines, last 3 kept as context around the trailing add.
    expect(marker?.collapsedCount).toBe(17);
    expect(rows[rows.length - 1].type).toBe("add");
  });

  it("keeps everything when the diff is short", () => {
    const rows = collapseUnchanged(diffLines("a\nb", "a\nc"), 3);
    expect(rows.some((r) => r.collapsed)).toBe(false);
  });

  it("keeps context lines on both sides of a change", () => {
    const before = manySame(10);
    const lines = before.split("\n");
    lines[5] = "CHANGED";
    const rows = collapseUnchanged(diffLines(before, lines.join("\n")), 1);
    const idxDel = rows.findIndex((r) => r.type === "del");
    expect(rows[idxDel - 1].type).toBe("same");
    expect(rows[idxDel - 1].collapsed).toBeUndefined();
    const after = rows.slice(idxDel + 1).filter((r) => !r.collapsed);
    expect(after.some((r) => r.type === "add")).toBe(true);
  });

  it("collapses a fully identical file to a single marker", () => {
    const text = manySame(30);
    const rows = collapseUnchanged(diffLines(text, text), 3);
    expect(rows).toHaveLength(1);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].collapsedCount).toBe(30);
  });
});

describe("diff round-trip integrity", () => {
  it("del rows reproduce the old text, add+same rows the new text", () => {
    const oldText = "h1\np\nbtn\nfooter";
    const newText = "h1\nnav\np\nfooter\nextra";
    const rows = diffLines(oldText, newText);
    const oldRebuilt = rows
      .filter((r: DiffRow) => r.type !== "add")
      .map((r) => r.text)
      .join("\n");
    const newRebuilt = rows
      .filter((r: DiffRow) => r.type !== "del")
      .map((r) => r.text)
      .join("\n");
    expect(oldRebuilt).toBe(oldText);
    expect(newRebuilt).toBe(newText);
  });
});
