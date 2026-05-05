---
ai_summary: "Full test coverage for DiagramView union semantics fix: 28 new tests covering parser (DBML→FilterConfig) and generator (FilterConfig→DBML) across all example cases, edge cases, and round-trip stability"
ai_warnings:
  - "Schemas/Notes with specific items require separate lines in DBML (comma-separated not supported by parser)"
ai_generated_at: "2026-04-15"
---

# Tests: DiagramView Union Semantics Fix

## What This Document Is
This document summarizes the test cases generated for this feature,
based on the specifications in 02-solutions.md and the example files
(dbml-filter-examples.md, filter-dbml-examples.md).

## Test Strategy

- Type: Unit tests
- Framework: vitest
- Repos: dbml (`packages/dbml-parse`)

## Test Files

| File | Tests | Focus |
|------|-------|-------|
| `__tests__/examples/interpreter/interpreter.test.ts` | 21 new | Parser: DBML → FilterConfig |
| `__tests__/examples/compiler/syncDiagramView.test.ts` | 32 new | Generator: FilterConfig → DBML |

## Parser Test Cases (DBML → FilterConfig)

Based on `dbml-filter-examples.md` groups D-H.

### Sub-Problem 1: expandDiagramViewWildcards

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-P01 | TableGroups `{ * }` sole trigger → expands to concrete group names | E4, 02-solutions Sub-Problem 1 | ✓ |
| UT-P02 | TableGroups `{ * }` expands even when Tables also set (always expand) | E1, 02-solutions Sub-Problem 1 | ✓ |
| UT-P03 | TableGroups `{ * }` expands alongside Schemas | E1, 02-solutions Sub-Problem 1 | ✓ |
| UT-P04 | TableGroups `{ * }` expands with Notes | E1 variant, 02-solutions Sub-Problem 1 | ✓ |
| UT-P05 | Body-level `{ * }` does NOT expand tableGroups | F1, 02-solutions Sub-Problem 1 | ✓ |
| UT-P06 | Trinity-promoted `[]` tableGroups not expanded (not a wildcard) | 02-solutions Sub-Problem 1 | ✓ |
| UT-P07 | TableGroups `{ * }` with no groups defined → stays `[]` | 02-solutions Sub-Problem 1 | ✓ |

### Trinity Omit Rule

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-T01 | Tables explicit → tableGroups and schemas promoted to `[]` | D1, 02-solutions Sub-Problem 2 | ✓ |
| UT-T02 | Tables `{ * }` → tableGroups and schemas promoted to `[]` | E2, 02-solutions Sub-Problem 2 | ✓ |
| UT-T03 | Tables + Notes explicit → tableGroups/schemas `[]`, stickyNotes `[]` | D1+Notes | ✓ |
| UT-T04 | TableGroups `{ * }` sole → tables/schemas promoted to `[]` | E4, 02-solutions Sub-Problem 2 | ✓ |
| UT-T05 | Schemas `{ * }` sole → tables/tableGroups promoted to `[]` | E3, 02-solutions Sub-Problem 2 | ✓ |
| UT-T06 | Tables + Schemas → tableGroups promoted to `[]` | D4, 02-solutions Sub-Problem 2 | ✓ |
| UT-T07 | TableGroups + Schemas → tables promoted to `[]` | D6, 02-solutions Sub-Problem 2 | ✓ |
| UT-T08 | All three Trinity dims set → no promotion needed | D7, 02-solutions Sub-Problem 2 | ✓ |
| UT-T09 | Tables `{ * }` + Notes → tableGroups/schemas `[]`, notes has items | F2, 02-solutions Sub-Problem 2 | ✓ |

### Empty / Null Blocks

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-N01 | Empty body `{ }` → all null | G1, 02-solutions Sub-Problem 2 | ✓ |
| UT-N02 | Empty Tables `{ }` → same as empty body | G2 | ✓ |
| UT-N03 | Empty TableGroups `{ }` → same as empty body | G2 | ✓ |
| UT-N04 | Empty Schemas `{ }` → same as empty body | G2 | ✓ |
| UT-N05 | Empty Notes `{ }` → same as empty body | G2 | ✓ |
| UT-N06 | Body-level `{ * }` → all `[]` | F1 | ✓ |
| UT-N07 | Only Notes `{ * }` → no Trinity omit, Trinity dims stay null | H1 | ✓ |
| UT-N08 | Only Notes with items → no Trinity omit | H1 | ✓ |

## Generator Test Cases (FilterConfig → DBML)

Based on `filter-dbml-examples.md` groups A-C.

### Group A: Legacy/Tricky Cases

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-G01 | A1: All null → empty block `{ }` | Rule A1 | ✓ |
| UT-G02 | A2: tableGroups null + tables items → emit tables only | Rule 1 | ✓ |
| UT-G03 | A3: tableGroups null + tables + schemas items → emit both | Rule 1 | ✓ |
| UT-G04 | A5: tables null + rest empty → `Notes { * }` | Rule 2 | ✓ |
| UT-G05 | A6: schemas null + rest empty → `Notes { * }` | Rule 2 | ✓ |
| UT-G06 | A7: tables null + schemas null → `Notes { * }` | Rule 2 | ✓ |
| UT-G07 | A8: tables null + other dims have items → union rule | Rule 3 | ✓ |
| UT-G08 | A9: schemas null + other dims have items → union rule | Rule 3 | ✓ |
| UT-G09 | A10: all Trinity null + notes empty → `Notes { * }` | Rule 2 | ✓ |

### Group B: Normal Cases (all non-null)

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-G10 | B1: all empty → body-level `{ * }` | Rule 4 | ✓ |
| UT-G11 | B2: only tables → emit Tables only | Rule 5 | ✓ |
| UT-G12 | B3: only tableGroups → emit TableGroups only | Rule 5 | ✓ |
| UT-G13 | B4: only schemas → emit Schemas only | Rule 5 | ✓ |
| UT-G14 | B5: tables + schemas → emit both | Rule 5 | ✓ |
| UT-G15 | B6: tables + tableGroups → emit both | Rule 5 | ✓ |
| UT-G16 | B7: tableGroups + schemas → emit both | Rule 5 | ✓ |
| UT-G17 | B8: all three → emit all | Rule 6 | ✓ |

### Group C: StickyNotes Combinations

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-G18 | C1: only notes → `Tables { * } Notes { items }` | Rule 4 variant | ✓ |
| UT-G19 | C2: tables + notes → emit both | Rule 5 | ✓ |

### Edge Cases & Additional Coverage

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-E01 | All Trinity null + notes items → `Notes { items }` | Truth table edge | ✓ |
| UT-E02 | Tables null + notes items → `Notes { items }` | Truth table edge | ✓ |
| UT-E03 | Schema-qualified table names (non-public) | Rule 5 | ✓ |
| UT-E04 | Public schema tables omit prefix | Rule 5 | ✓ |
| UT-E05 | Union rule with notes (tables null + 3 dims) | Rule 3 variant | ✓ |
| UT-E06 | Multiple tables in block | Rule 5 | ✓ |
| UT-E07 | Multiple tableGroups in block | Rule 5 | ✓ |
| UT-E08 | Delete operation still works | Existing behavior | ✓ |
| UT-E09 | Update operation replaces content | Existing behavior | ✓ |

### Tables/Schemas Wildcard Union (Group I)

> When Tables has `*` or Schemas has `*`, union covers everything → all Trinity dims become `[]`.
> TableGroups `*` does NOT trigger this rule — it expands to concrete names instead.

| ID | Description | Based On | Status |
|----|-------------|----------|--------|
| UT-I01 | Tables { items } + Schemas { * } → all Trinity [] | I1, Rule 7 | ✓ |
| UT-I02 | Tables { * } + Schemas { items } → all Trinity [] | I2, Rule 7 | ✓ |
| UT-I03 | TableGroups { items } + Tables { * } → all Trinity [] | I3, Rule 7 | ✓ |
| UT-I04 | TableGroups { items } + Schemas { * } → all Trinity [] | I4, Rule 7 | ✓ |
| UT-I05 | Tables { * } + Schemas { * } → all Trinity [] | I5, Rule 7 | ✓ |
| UT-I06 | Tables { items } + TableGroups { * } → TableGroups expands, Tables preserved | I6 | ✓ |

### Round-trip Stability Tests

| ID | Input FC | → DBML | → FC | Status |
|----|----------|--------|------|--------|
| UT-R01 | `n,n,n,n` | `{ }` | `n,n,n,n` | ✓ |
| UT-R02 | `[],[],[],[]` | `{ * }` | `[],[],[],[]` | ✓ |
| UT-R03 | `[],[],[],[N]` | `Tables{*} Notes{N}` | `[],[],[],[N]` | ✓ |
| UT-R04 | `n,n,n,[]` | `Notes { * }` | `n,n,n,[]` | ✓ |

## Coverage Summary

| Area | Cases Tested | Source |
|------|-------------|--------|
| expandDiagramViewWildcards | 7 | 02-solutions Sub-Problem 1 |
| Trinity omit rule | 9 | dbml-filter-examples.md |
| Empty/null blocks | 8 | dbml-filter-examples.md G group |
| Tables/Schemas wildcard union | 6 | dbml-filter-examples.md Group I |
| Generation rules (A1-A10) | 9 | filter-dbml-examples.md Group A |
| Generation rules (B1-B8) | 8 | filter-dbml-examples.md Group B |
| Generation rules (C1-C2) | 2 | filter-dbml-examples.md Group C |
| Edge cases | 9 | 02-solutions.md truth tables |
| Round-trip stability | 4 | 02-solutions.md truth tables |
| **Total** | **62** | |

## Known Limitations

1. **Comma-separated items in sub-blocks**: DBML parser does not support `Tables { users, orders }` — items must be on separate lines. Tests use line-separated syntax.
2. **Undeclared schema references**: `Schemas { sales }` where `sales` is not a declared table/schema causes parse failure. Tests use `Schemas { * }` instead.
3. **Not fully 1:1**: See truth tables in 02-solutions.md for non-1:1 patterns (all functionally equivalent).
