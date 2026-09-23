#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MarkdownTable, TableAlignment } from "./utils/markdownTable.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES = ["dbml-cli", "dbml-connector", "dbml-core", "dbml-parse"];
const COVERAGE_THRESHOLD = 80;

function readCoverageSummary(packageName: string): Record<string, any> | undefined {
  const summaryPath = path.join(
    __dirname,
    "../../../packages",
    packageName,
    "coverage",
    "coverage-summary.json",
  );

  if (!fs.existsSync(summaryPath)) {
    console.error(`Warning: No coverage summary found for ${packageName}`);
    return undefined;
  }

  return JSON.parse(fs.readFileSync(summaryPath, "utf8"));
}

function formatPercentage(value: number): string {
  return value.toFixed(2) + "%";
}

function getIcon(percentage: number): string {
  if (percentage >= 80) return "✅";
  if (percentage >= 50) return "⚠️";
  return "❌";
}

function getFilesWithLowCoverage(
  coverageData: Record<string, any>,
  packageName: string,
  threshold = 80,
) {
  const files: Record<string, any>[] = [];

  for (const [filePath, coverage] of Object.entries(coverageData)) {
    if (filePath === "total") continue;

    const linePct = coverage.lines.pct;
    const stmtPct = coverage.statements.pct;
    const funcPct = coverage.functions.pct;
    const branchPct = coverage.branches.pct;

    if (
      linePct < threshold ||
      stmtPct < threshold ||
      funcPct < threshold ||
      branchPct < threshold
    ) {
      const packageDir = path.join("packages", packageName);
      const relativePath = path.relative(
        path.join(process.cwd(), packageDir),
        filePath,
      );

      files.push({
        path: relativePath,
        lines: linePct,
        statements: stmtPct,
        functions: funcPct,
        branches: branchPct,
      });
    }
  }

  files.sort((a, b) => a.lines - b.lines);
  return files;
}

function generateMarkdownReport(coverageData: Record<string, any>[], commitSha: string) {
  let markdown = `## Coverage Report\n\n`;
  markdown += `**Commit:** ${commitSha}\n\n`;

  const overallLines = { total: 0, covered: 0 };
  const overallBranches = { total: 0, covered: 0 };
  const overallFunctions = { total: 0, covered: 0 };
  const overallStatements = { total: 0, covered: 0 };

  for (const pkg of coverageData) {
    if (!pkg.coverageData || !pkg.coverageData.total) continue;

    overallLines.total += pkg.coverageData.total.lines.total;
    overallLines.covered += pkg.coverageData.total.lines.covered;
    overallBranches.total += pkg.coverageData.total.branches.total;
    overallBranches.covered += pkg.coverageData.total.branches.covered;
    overallFunctions.total += pkg.coverageData.total.functions.total;
    overallFunctions.covered += pkg.coverageData.total.functions.covered;
    overallStatements.total += pkg.coverageData.total.statements.total;
    overallStatements.covered += pkg.coverageData.total.statements.covered;
  }

  const overallLinePct = (overallLines.covered / overallLines.total) * 100;
  const overallBranchPct =
    (overallBranches.covered / overallBranches.total) * 100;
  const overallFunctionPct =
    (overallFunctions.covered / overallFunctions.total) * 100;
  const overallStatementPct =
    (overallStatements.covered / overallStatements.total) * 100;

  // Overall coverage table
  markdown += `### Overall Coverage\n\n`;
  markdown += new MarkdownTable()
    .headers(["Metric", "Coverage"])
    .align([TableAlignment.Left, TableAlignment.Left])
    .row([
      "Lines",
      `${getIcon(overallLinePct)} ${formatPercentage(overallLinePct)} (${overallLines.covered}/${overallLines.total})`,
    ])
    .row([
      "Statements",
      `${getIcon(overallStatementPct)} ${formatPercentage(overallStatementPct)} (${overallStatements.covered}/${overallStatements.total})`,
    ])
    .row([
      "Functions",
      `${getIcon(overallFunctionPct)} ${formatPercentage(overallFunctionPct)} (${overallFunctions.covered}/${overallFunctions.total})`,
    ])
    .row([
      "Branches",
      `${getIcon(overallBranchPct)} ${formatPercentage(overallBranchPct)} (${overallBranches.covered}/${overallBranches.total})`,
    ])
    .build();
  markdown += "\n\n";

  // Package coverage table
  markdown += `### Package Coverage\n\n`;
  const pkgTable = new MarkdownTable()
    .headers(["Package", "Lines", "Statements", "Functions", "Branches"])
    .align([TableAlignment.Left, TableAlignment.Right, TableAlignment.Right, TableAlignment.Right, TableAlignment.Right]);

  for (const pkg of coverageData) {
    if (!pkg.coverageData || !pkg.coverageData.total) {
      pkgTable.row([`${pkg.name}`, "N/A", "N/A", "N/A", "N/A"]);
      continue;
    }

    const t = pkg.coverageData.total;
    pkgTable.row([
      `${pkg.name}`,
      `${getIcon(t.lines.pct)} ${formatPercentage(t.lines.pct)}`,
      `${getIcon(t.statements.pct)} ${formatPercentage(t.statements.pct)}`,
      `${getIcon(t.functions.pct)} ${formatPercentage(t.functions.pct)}`,
      `${getIcon(t.branches.pct)} ${formatPercentage(t.branches.pct)}`,
    ]);
  }

  markdown += pkgTable.build() + "\n\n";

  // Warnings for packages below threshold
  const lowCoveragePackages = coverageData.filter(
    (pkg) =>
      pkg.coverageData &&
      pkg.coverageData.total &&
      pkg.coverageData.total.lines.pct < COVERAGE_THRESHOLD,
  );

  if (lowCoveragePackages.length > 0) {
    markdown += `### ⚠️ Coverage Warnings\n\n`;
    markdown += `The following packages have coverage below ${COVERAGE_THRESHOLD}%:\n\n`;
    for (const pkg of lowCoveragePackages) {
      markdown += `- **${pkg.name}**: ${formatPercentage(pkg.coverageData.total.lines.pct)} line coverage\n`;
    }
    markdown += `\n`;
  }

  // File-level low coverage reporting
  markdown += `### Files with Coverage Below ${COVERAGE_THRESHOLD}%\n\n`;

  let hasLowCoverageFiles = false;

  for (const pkg of coverageData) {
    if (!pkg.coverageData) continue;

    const lowCoverageFiles = getFilesWithLowCoverage(
      pkg.coverageData,
      pkg.name,
      COVERAGE_THRESHOLD,
    );

    if (lowCoverageFiles.length > 0) {
      hasLowCoverageFiles = true;

      markdown += `#### ${pkg.name}\n\n`;
      markdown += "<details>\n";
      markdown += `<summary>${lowCoverageFiles.length} file(s) below ${COVERAGE_THRESHOLD}% coverage</summary>\n\n`;

      const fileTable = new MarkdownTable()
        .headers(["File", "Lines", "Statements", "Functions", "Branches"])
        .align([TableAlignment.Left, TableAlignment.Right, TableAlignment.Right, TableAlignment.Right, TableAlignment.Right]);

      for (const file of lowCoverageFiles) {
        fileTable.row([
          `\`${file.path}\``,
          formatPercentage(file.lines),
          formatPercentage(file.statements),
          formatPercentage(file.functions),
          formatPercentage(file.branches),
        ]);
      }

      markdown += fileTable.build() + "\n\n";
      markdown += "</details>\n\n";
    }
  }

  if (!hasLowCoverageFiles) {
    markdown += `All files have coverage at or above ${COVERAGE_THRESHOLD}%! 🎉\n\n`;
  }

  // Set GitHub Actions outputs
  if (process.env.GITHUB_OUTPUT) {
    const output = [
      `overall-lines=${overallLinePct.toFixed(2)}`,
      `overall-branches=${overallBranchPct.toFixed(2)}`,
      `overall-functions=${overallFunctionPct.toFixed(2)}`,
      `overall-statements=${overallStatementPct.toFixed(2)}`,
    ].join("\n");

    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + "\n");
  }

  return markdown;
}

function main() {
  const commitSha =
    process.env.GITHUB_SHA ||
    execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();

  console.log("Collecting coverage data from packages...");

  const coverageData = PACKAGES.map((packageName) => {
    console.log(`- Reading coverage for ${packageName}...`);
    const data = readCoverageSummary(packageName);
    return { name: packageName, coverageData: data };
  });

  console.log("\nGenerating coverage report...");
  const markdown = generateMarkdownReport(
    coverageData,
    commitSha.substring(0, 8),
  );

  const reportPath = path.join(__dirname, "../../../coverage-report.md");
  fs.writeFileSync(reportPath, markdown);
  console.log(`\nCoverage report written to: ${reportPath}`);

  console.log("\n" + markdown);

  const criticallyLowCoverage = coverageData.some(
    (pkg) =>
      pkg.coverageData &&
      pkg.coverageData.total &&
      pkg.coverageData.total.lines.pct < 60,
  );

  if (criticallyLowCoverage) {
    console.error(
      "\n❌ Critical: One or more packages have coverage below 60%",
    );
  }
}

main();
