#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PACKAGES = ['dbml-cli', 'dbml-connector', 'dbml-core', 'dbml-parse'];
const COVERAGE_THRESHOLD = 80; // Warning threshold for coverage

function readCoverageSummary(packageName) {
  const summaryPath = path.join(__dirname, '../../../packages', packageName, 'coverage', 'coverage-summary.json');

  if (!fs.existsSync(summaryPath)) {
    console.error(`Warning: No coverage summary found for ${packageName}`);
    return null;
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  return summary;
}

function formatPercentage(value) {
  return value.toFixed(2) + '%';
}

function getIcon(percentage) {
  if (percentage >= 80) return '✅';
  if (percentage >= 50) return '⚠️';
  return '❌';
}

function getFilesWithLowCoverage(coverageData, packageName, threshold = 80) {
  const files = [];

  for (const [filePath, coverage] of Object.entries(coverageData)) {
    if (filePath === 'total') continue;

    // Check if any metric is below threshold
    const linePct = coverage.lines.pct;
    const stmtPct = coverage.statements.pct;
    const funcPct = coverage.functions.pct;
    const branchPct = coverage.branches.pct;

    if (linePct < threshold || stmtPct < threshold || funcPct < threshold || branchPct < threshold) {
      // Get relative path from package directory
      const packageDir = path.join('packages', packageName);
      const relativePath = path.relative(path.join(process.cwd(), packageDir), filePath);

      files.push({
        path: relativePath,
        lines: linePct,
        statements: stmtPct,
        functions: funcPct,
        branches: branchPct,
      });
    }
  }

  // Sort by lowest line coverage first
  files.sort((a, b) => a.lines - b.lines);

  return files;
}

function generateMarkdownReport(coverageData, commitSha) {
  let markdown = `## Coverage Report\n\n`;
  markdown += `**Commit:** ${commitSha}\n\n`;

  let overallLines = { total: 0, covered: 0 };
  let overallBranches = { total: 0, covered: 0 };
  let overallFunctions = { total: 0, covered: 0 };
  let overallStatements = { total: 0, covered: 0 };

  // Calculate overall coverage
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
  const overallBranchPct = (overallBranches.covered / overallBranches.total) * 100;
  const overallFunctionPct = (overallFunctions.covered / overallFunctions.total) * 100;
  const overallStatementPct = (overallStatements.covered / overallStatements.total) * 100;

  markdown += `### Overall Coverage\n\n`;
  markdown += `| Metric | Coverage |\n`;
  markdown += `|--------|----------|\n`;
  markdown += `| Lines | ${getIcon(overallLinePct)} ${formatPercentage(overallLinePct)} (${overallLines.covered}/${overallLines.total}) |\n`;
  markdown += `| Statements | ${getIcon(overallStatementPct)} ${formatPercentage(overallStatementPct)} (${overallStatements.covered}/${overallStatements.total}) |\n`;
  markdown += `| Functions | ${getIcon(overallFunctionPct)} ${formatPercentage(overallFunctionPct)} (${overallFunctions.covered}/${overallFunctions.total}) |\n`;
  markdown += `| Branches | ${getIcon(overallBranchPct)} ${formatPercentage(overallBranchPct)} (${overallBranches.covered}/${overallBranches.total}) |\n\n`;

  markdown += `### Package Coverage\n\n`;
  markdown += `| Package | Lines | Statements | Functions | Branches |\n`;
  markdown += `|---------|-------|------------|-----------|----------|\n`;

  for (const pkg of coverageData) {
    if (!pkg.coverageData || !pkg.coverageData.total) {
      markdown += `| @dbml/${pkg.name} | N/A | N/A | N/A | N/A |\n`;
      continue;
    }

    const linePct = pkg.coverageData.total.lines.pct;
    const stmtPct = pkg.coverageData.total.statements.pct;
    const funcPct = pkg.coverageData.total.functions.pct;
    const branchPct = pkg.coverageData.total.branches.pct;

    markdown += `| @dbml/${pkg.name} | ${getIcon(linePct)} ${formatPercentage(linePct)} | ${getIcon(stmtPct)} ${formatPercentage(stmtPct)} | ${getIcon(funcPct)} ${formatPercentage(funcPct)} | ${getIcon(branchPct)} ${formatPercentage(branchPct)} |\n`;
  }

  markdown += `\n`;

  // Add warnings for packages below threshold
  const lowCoveragePackages = coverageData.filter(pkg =>
    pkg.coverageData && pkg.coverageData.total && pkg.coverageData.total.lines.pct < COVERAGE_THRESHOLD
  );

  if (lowCoveragePackages.length > 0) {
    markdown += `### ⚠️ Coverage Warnings\n\n`;
    markdown += `The following packages have coverage below ${COVERAGE_THRESHOLD}%:\n\n`;
    for (const pkg of lowCoveragePackages) {
      markdown += `- **@dbml/${pkg.name}**: ${formatPercentage(pkg.coverageData.total.lines.pct)} line coverage\n`;
    }
    markdown += `\n`;
  }

  // Add file-level low coverage reporting
  markdown += `### Files with Coverage Below ${COVERAGE_THRESHOLD}%\n\n`;

  let hasLowCoverageFiles = false;

  for (const pkg of coverageData) {
    if (!pkg.coverageData) continue;

    const lowCoverageFiles = getFilesWithLowCoverage(pkg.coverageData, pkg.name, COVERAGE_THRESHOLD);

    if (lowCoverageFiles.length > 0) {
      hasLowCoverageFiles = true;

      markdown += `#### @dbml/${pkg.name}\n\n`;
      markdown += '<details>\n';
      markdown += `<summary>${lowCoverageFiles.length} file(s) below ${COVERAGE_THRESHOLD}% coverage</summary>\n\n`;
      markdown += '| File | Lines | Statements | Functions | Branches |\n';
      markdown += '|------|-------|------------|-----------|----------|\n';

      for (const file of lowCoverageFiles) {
        markdown += `| \`${file.path}\` | ${formatPercentage(file.lines)} | ${formatPercentage(file.statements)} | ${formatPercentage(file.functions)} | ${formatPercentage(file.branches)} |\n`;
      }

      markdown += '\n</details>\n\n';
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
    ].join('\n');

    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + '\n');
  }

  return markdown;
}

function main() {
  // Get commit SHA from environment or git
  const commitSha = process.env.GITHUB_SHA ||
    require('child_process').execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

  console.log('Collecting coverage data from packages...');

  const coverageData = PACKAGES.map(packageName => {
    console.log(`- Reading coverage for ${packageName}...`);
    const coverageData = readCoverageSummary(packageName);
    return {
      name: packageName,
      coverageData
    };
  });

  console.log('\nGenerating coverage report...');
  const markdown = generateMarkdownReport(coverageData, commitSha.substring(0, 8));

  // Write markdown report
  const reportPath = path.join(__dirname, '../../../coverage-report.md');
  fs.writeFileSync(reportPath, markdown);
  console.log(`\nCoverage report written to: ${reportPath}`);

  // Output to console
  console.log('\n' + markdown);

  const criticallyLowCoverage = coverageData.some(pkg =>
    pkg.coverageData && pkg.coverageData.total && pkg.coverageData.total.lines.pct < 60
  );

  if (criticallyLowCoverage) {
    console.error('\n❌ Critical: One or more packages have coverage below 60%');
  }
}

if (require.main === module) {
  main();
}
