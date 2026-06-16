#!/usr/bin/env node

/**
 * Collect and compare benchmarks between the current branch and a base branch (default: master).
 *
 * Usage:
 *   npx tsx collect-benchmarks.mts [base-branch]
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MarkdownTable, TableAlignment } from "./utils/markdownTable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../../..");
const PKG_DIR = path.join(ROOT, "packages/dbml-parse");
const BENCH_DIR = path.join(PKG_DIR, "__benchmarks__");
const BENCH_OUTPUT = path.join(BENCH_DIR, "output/bench.json");
const TMP_DIR = path.join(ROOT, ".tmp-bench");

interface BenchResult {
  ms: number;
  error: number;
  count: number;
}

type BenchReport = Record<string, BenchResult>;

function main() {
  const baseBranch = process.argv[2] || "master";

  console.log("Running benchmarks on current branch...");
  runBenchmarks();
  const current = readReport();

  console.log(`\nRunning benchmarks on ${baseBranch}...`);
  const baseline = runOnBranch(baseBranch);

  const markdown = generateReport(current, baseline, baseBranch);
  const reportPath = path.join(ROOT, "benchmark-report.md");
  fs.writeFileSync(reportPath, markdown);
  console.log(`\nBenchmark report written to: ${reportPath}`);
  console.log("\n" + markdown);

  if (process.env.GITHUB_OUTPUT) {
    for (const [suite, v] of Object.entries(current)) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `dbml-parse-${suite}=${v.ms}\n`);
    }
  }
}

function runBenchmarks() {
  execSync("npx tsx __benchmarks__/compiler.benchmark.ts", {
    cwd: PKG_DIR,
    stdio: "inherit",
  });
}

function readReport(): BenchReport {
  if (!fs.existsSync(BENCH_OUTPUT)) {
    console.error("No benchmark results found");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(BENCH_OUTPUT, "utf8"));
}

function runOnBranch(branch: string): BenchReport | undefined {
  const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();

  execSync(`mkdir -p '${TMP_DIR}' && cp -r '${BENCH_DIR}/.' '${TMP_DIR}/'`, { cwd: ROOT });

  const stashOutput = execSync("git stash", { cwd: ROOT, encoding: "utf8" }).trim();
  const didStash = !stashOutput.includes("No local changes");

  try {
    execSync(`git checkout ${branch}`, { cwd: ROOT, stdio: "inherit" });
    execSync(`mkdir -p '${BENCH_DIR}' && cp -r '${TMP_DIR}/.' '${BENCH_DIR}/'`, { cwd: ROOT });

    runBenchmarks();
    return readReport();
  } catch (e) {
    console.error(`Failed to run benchmarks on ${branch}:`, (e as Error).message);
    return undefined;
  } finally {
    execSync(`git checkout ${currentBranch}`, { cwd: ROOT, stdio: "inherit" });
    if (didStash) execSync("git stash pop", { cwd: ROOT, stdio: "inherit" });
    execSync(`rm -rf '${TMP_DIR}'`, { cwd: ROOT });
  }
}

function formatMs(v: BenchResult): string {
  const error = Math.round(v.error * 10000) / 100;
  return `${v.ms}ms \u00b1${error}%`;
}

function formatChange(current: BenchResult, baseline: BenchResult): string {
  const pct = ((current.ms - baseline.ms) / baseline.ms) * 100;
  const sign = pct >= 0 ? "+" : "";
  const icon = pct <= -5 ? "\uD83D\uDFE2" : pct >= 5 ? "\uD83D\uDD34" : "\u26AA";
  return `${icon} ${sign}${pct.toFixed(1)}%`;
}

function generateReport(current: BenchReport, baseline: BenchReport | undefined, baseBranch: string): string {
  let md = `## Benchmark Result\n\n`;
  md += `### dbml-parse\n\n`;

  const table = new MarkdownTable()
    .headers(["suite", `\uD83C\uDFE0 ${baseBranch}`, `\uD83D\uDD00 this branch`, "change"])
    .align([TableAlignment.Left, TableAlignment.Right, TableAlignment.Right, TableAlignment.Right]);

  const allSuites = new Set([
    ...Object.keys(current),
    ...(baseline ? Object.keys(baseline) : []),
  ]);

  for (const suite of allSuites) {
    const cur = current[suite];
    const base = baseline?.[suite];
    table.row([
      suite,
      base ? formatMs(base) : "N/A",
      cur ? formatMs(cur) : "N/A",
      cur && base ? formatChange(cur, base) : "",
    ]);
  }

  md += table.build() + "\n";
  return md;
}

main();
