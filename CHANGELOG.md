## v8.2.0 (2026-05-21)

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#901](https://github.com/holistics/dbml/pull/901) Support `inactive` setting on ref ([@huydo862003](https://github.com/huydo862003))

#### :bug: Bug Fix
* `dbml-core`
  * Fix TypeScript error when passing `Parser.parse()` result to functions expecting `Database` type (introduced in v8.1.0) ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v8.1.0 (2026-05-20)

#### :rocket: New Feature
* `dbml-core`
  * [#904](https://github.com/holistics/dbml/pull/904) Add stateful multifile API: `setDbmlSource`, `getDbmlSource`, `deleteDbmlSource`, `clearDbmlSource`, `parseDbmlProject` ([@huydo862003](https://github.com/huydo862003))
  * [#904](https://github.com/holistics/dbml/pull/904) Expose `diagramViews` on `Database` object ([@huydo862003](https://github.com/huydo862003))
  * [#904](https://github.com/holistics/dbml/pull/904) Accept bare strings as file paths in multifile APIs ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#904](https://github.com/holistics/dbml/pull/904) Add syntax highlighting for `~` operator in Monaco editor ([@huydo862003](https://github.com/huydo862003))

#### :bug: Bug Fix
* `dbml-core`
  * [#904](https://github.com/holistics/dbml/pull/904) Fix `Parser.parseDBMLToJSONv2` silently ignoring syntax errors instead of throwing ([@huydo862003](https://github.com/huydo862003))

#### :memo: Documentation
* `dbml-core`
  * [#904](https://github.com/holistics/dbml/pull/904) Document stateful multifile API (`setDbmlSource`, `getDbmlSource`, `deleteDbmlSource`, `clearDbmlSource`, `parseDbmlProject`) ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v8.0.0 (2026-05-15)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#870](https://github.com/holistics/dbml/pull/870) Multifile support ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-core`, `dbml-parse`
  * [#883](https://github.com/holistics/dbml/pull/883) Playground rewrite ([@huydo862003](https://github.com/huydo862003))
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#870](https://github.com/holistics/dbml/pull/870) Query-based compiler ([@huydo862003](https://github.com/huydo862003))
* `dbml-core`
  * [#870](https://github.com/holistics/dbml/pull/870) `Parser` constructor no longer accepts a compiler. ([@huydo862003](https://github.com/huydo862003))
  * [#870](https://github.com/holistics/dbml/pull/870) `Parser.parseDBMLToJSONv2` no longer accepts a compiler parameter. ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#870](https://github.com/holistics/dbml/pull/870) Language services now require `TextModel` URIs to be set. ([@huydo862003](https://github.com/huydo862003))

#### :memo: Documentation
* [#899](https://github.com/holistics/dbml/pull/899) Add information about Elixir DBML support ([@saleyn](https://github.com/saleyn))

#### :robot: Dependencies Update
* `dbml-cli`
  * [#865](https://github.com/holistics/dbml/pull/865) chore(deps): bump lodash from 4.17.21 to 4.18.1 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* `dbml-parse`
  * [#869](https://github.com/holistics/dbml/pull/869) chore(deps): bump follow-redirects from 1.15.11 to 1.16.0 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#895](https://github.com/holistics/dbml/pull/895) chore(deps): bump picomatch from 2.3.1 to 2.3.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#893](https://github.com/holistics/dbml/pull/893) chore(deps): bump immutable from 4.3.5 to 4.3.8 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#894](https://github.com/holistics/dbml/pull/894) chore(deps): bump lodash-es from 4.17.21 to 4.18.1 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#892](https://github.com/holistics/dbml/pull/892) chore(deps): bump flatted from 3.3.3 to 3.4.2 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#789](https://github.com/holistics/dbml/pull/789) chore(deps): bump jws from 3.2.2 to 3.2.3 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#886](https://github.com/holistics/dbml/pull/886) chore(deps): bump postcss from 8.5.6 to 8.5.13 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#891](https://github.com/holistics/dbml/pull/891) chore(deps): bump rollup from 4.52.3 to 4.60.2 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#890](https://github.com/holistics/dbml/pull/890) chore(deps): bump handlebars from 4.7.8 to 4.7.9 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#832](https://github.com/holistics/dbml/pull/832) chore(deps): bump bn.js from 4.12.0 to 4.12.3 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#864](https://github.com/holistics/dbml/pull/864) chore(deps): bump axios from 1.9.0 to 1.15.2 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#863](https://github.com/holistics/dbml/pull/863) chore(deps-dev): bump vite from 7.1.7 to 7.3.2 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 4
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Serge Aleynikov ([@saleyn](https://github.com/saleyn))
- [@blacksmith-sh[bot]](https://github.com/apps/blacksmith-sh)

## v7.1.2 (2026-04-28)

#### :robot: Dependencies Update
* `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#885](https://github.com/holistics/dbml/pull/885) misc(dbml-parse): upgrade lodash-es to v4.18.1 ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 1
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))

## v7.1.1 (2026-04-17)

#### :bug: Bug Fix
* `dbml-parse`
  * [#877](https://github.com/holistics/dbml/pull/877) Fix missing double quotes on table, table group, sticky note, and schema names when syncing DiagramView ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-core`, `dbml-parse`
  * [#876](https://github.com/holistics/dbml/pull/876) Fix `model_structure` types not being importable from `@dbml/core` ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v7.1.0 (2026-04-16)

#### :memo: Documentation
* [#858](https://github.com/holistics/dbml/pull/858) Docs: DiagramView block ([@NQPhuc](https://github.com/NQPhuc))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#873](https://github.com/holistics/dbml/pull/873) Fix wrong union type in DiagramView ([@huyphung1602](https://github.com/huyphung1602))

#### :house_with_garden: Internal
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#856](https://github.com/holistics/dbml/pull/856) Make snapshot tests more robust ([@huydo862003](https://github.com/huydo862003))
* `dbml-connector`
  * [#867](https://github.com/holistics/dbml/pull/867) Bump fast-xml-parser to 5.5.7 ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#787](https://github.com/holistics/dbml/pull/787) chore(deps): bump node-forge from 1.3.1 to 1.3.3 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* Other
  * [#813](https://github.com/holistics/dbml/pull/813) chore(deps): bump @isaacs/brace-expansion from 5.0.0 to 5.0.1 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 3
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v7.0.0 (2026-04-10)

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#849](https://github.com/holistics/dbml/pull/849) Support DiagramView as code syntax ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 1
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v6.6.0 (2026-04-02)

#### :memo: Documentation
* [#848](https://github.com/holistics/dbml/pull/848) Add Jetbrains plugin to README.md ([@LiamClarkeNZ](https://github.com/LiamClarkeNZ))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#850](https://github.com/holistics/dbml/pull/850) Add token position to `TableRecord` for source location tracking ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 2
- Liam Clarke-Hutchinson ([@LiamClarkeNZ](https://github.com/LiamClarkeNZ))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v6.5.0 (2026-03-24)

#### :memo: Documentation
* [#837](https://github.com/holistics/dbml/pull/837) Refactor documentation structure and improve wording ([@TeaNguyen](https://github.com/TeaNguyen))

#### :bug: Bug Fix
* `dbml-core`
  * [#839](https://github.com/holistics/dbml/pull/839) Fix PostgreSQL parser crash on `UNIQUE NULLS NOT DISTINCT` constraint (PostgreSQL 15+) ([@frenzzy](https://github.com/frenzzy))
* `dbml-connector`
  * [#835](https://github.com/holistics/dbml/pull/835) Fix crash in MSSQL db2dbml when check constraints are null or inaccessible ([@ajar](https://github.com/ajar))

#### :rocket: New Feature
* `dbml-core`
  * [#844](https://github.com/holistics/dbml/pull/844) Link record IDs with table IDs and export `recordIds` in normalized model ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 4
- Aaron Artille ([@ajar](https://github.com/ajar))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Thi Nguyen ([@TeaNguyen](https://github.com/TeaNguyen))
- Vladimir Kutepov ([@frenzzy](https://github.com/frenzzy))

## v6.4.0 (2026-02-26)

#### :bug: Bug Fix
* `dbml-core`
  * [#830](https://github.com/holistics/dbml/pull/830) Fix TypeScript type definitions not resolving for CommonJS consumers of `@dbml/core` ([@huydo862003](https://github.com/huydo862003))

#### :rocket: New Feature
* `dbml-core`
  * [#831](https://github.com/holistics/dbml/pull/831) Add `includeRecords` option to exporter and importer to control record generation ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v6.3.0 (2026-02-13)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#800](https://github.com/holistics/dbml/pull/800) Support sample table data in DBML - Add `Records` blocks to define sample data within tables or as standalone elements with full constraint validation (PK, FK, unique, not null) ([@huydo862003](https://github.com/huydo862003))
  * [#800](https://github.com/holistics/dbml/pull/800) Support parsing INSERT statements from SQL and converting to DBML `Records` (MySQL, PostgreSQL, Oracle, MSSQL, Snowflake) ([@huydo862003](https://github.com/huydo862003))
  * [#800](https://github.com/holistics/dbml/pull/800) Support exporting `Records` to INSERT statements in all SQL dialects with automatic constraint handling ([@huydo862003](https://github.com/huydo862003))
  * [#800](https://github.com/holistics/dbml/pull/800) Add support for scientific notation in number literals (e.g., `1.23e5`, `-4.56e-3`) ([@huydo862003](https://github.com/huydo862003))
  * [#800](https://github.com/holistics/dbml/pull/800) Add `DBMLDiagnosticsProvider` class with `provideDiagnostics()`, `provideErrors()`, `provideWarnings()` methods ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-core`
  * [#800](https://github.com/holistics/dbml/pull/800) `Report` type signature changed from `Report<T, E>` to `Report<T>`. Use `getErrors()` and `getWarnings()` to access diagnostics ([@huydo862003](https://github.com/huydo862003))

#### :bug: Bug Fix
* `dbml-core`
  * Fix `null` values being exported with inconsistent casing (`NULL`, `null`, `Null`) in SQL export ([@huydo862003](https://github.com/huydo862003))
  * Fix `RecordValue`, `NormalizedRecord` and other types not being importable from `@dbml/core` ([@huydo862003](https://github.com/huydo862003))
  * Fix parser crash due to incorrect Token import ([@huydo862003](https://github.com/huydo862003))

#### :house_with_garden: Internal
* `dbml-core`
  * Build output now uses `.cjs` and `.esm` file extensions for non-ambiguity in module loaders ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v6.2.1 (2026-02-11)

#### :house_with_garden: Internal
* `dbml-core`
  * [#821](https://github.com/holistics/dbml/pull/821) Expose non-normalized model structure types ([@huydo862003](https://github.com/huydo862003))
  * [#821](https://github.com/holistics/dbml/pull/821) Make `RawField`'s `dbdefault` a precise type ([@huydo862003](https://github.com/huydo862003))
  * [#821](https://github.com/holistics/dbml/pull/821) Add missing `records` field to `NormalizedModel` ([@huydo862003](https://github.com/huydo862003))
  * [#821](https://github.com/holistics/dbml/pull/821) Add `NormalizedRecord` and `NormalizedRecordIdMap` and remove `NormalizedRecords` for consistency with other types ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v6.2.0 (2026-02-10)

#### :house_with_garden: Internal
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#798](https://github.com/holistics/dbml/pull/798) Migrate to vite & vitest to speed up build & test process and reduce bundle size ([@huydo862003](https://github.com/huydo862003))
    * Bundle size:
      * Before: 33MB (CJS)
      * After: 15MB (CJS), 25MB (ESM)
    * Build performance:
      * Before: ~1.5 min
      * After: ~10 sec
    * Test performance:
      * Before: ~10 min
      * After: ~3 min
  * [#798](https://github.com/holistics/dbml/pull/798) No longer upload unnecessary HTML coverage reports to github to reduce CI cost ([@huydo862003](https://github.com/huydo862003))
* `dbml-core`
  * [#798](https://github.com/holistics/dbml/pull/798) Disable coverage tests & run normal tests for `@dbml/core` in CI as the package is too large ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v6.1.0 (2026-02-06)

#### :house_with_garden: Internal
* `dbml-core`
  * [#816](https://github.com/holistics/dbml/pull/816) Expose normalized model structure types from `@dbml/core` ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v6.0.0 (2026-02-05)

#### :bug: Bug Fix
* `dbml-parse`
  * [#811](https://github.com/holistics/dbml/pull/811) Fix crash when Ref appears inside an unknown element ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-core`
  * [#812](https://github.com/holistics/dbml/pull/812) Support PostgreSQL JSON operators (`->>`, `#>>`, `#>`, etc.) in parser ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 2
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v5.5.1 (2026-01-30)

#### :bug: Bug Fix
* `dbml-parse`
  * [#808](https://github.com/holistics/dbml/pull/808) Fix incomplete refs (e.g. `Ref: T.id > T`) failing silently instead of reporting validation errors ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v5.5.0 (2026-01-30)

#### :bug: Bug Fix
* `dbml-core`
  * [#806](https://github.com/holistics/dbml/pull/806) Fix MSSQL parser failing on `ALTER TABLE WITH CHECK` statements ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-parse`
  * [#530](https://github.com/holistics/dbml/pull/530) Refactor binder and TablePartial injection handling ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v5.4.1 (2026-01-13)

#### :bug: Bug Fix
* `dbml-connector`
  * [#782](https://github.com/holistics/dbml/pull/782) Fix connection leak in `@dbml/connector` ([@huydo862003](https://github.com/huydo862003))
  * [#782](https://github.com/holistics/dbml/pull/782) Fix incorrect token offsets and empty element name handling ([@huydo862003](https://github.com/huydo862003))

#### :house_with_garden: Internal
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#782](https://github.com/holistics/dbml/pull/782) Setup coverage tests ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#782](https://github.com/holistics/dbml/pull/782) Setup property-based, example-based & fuzz testing ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v5.4.0 (2026-01-09)

#### :memo: Documentation
* `dbml-core`
  * [#791](https://github.com/holistics/dbml/pull/791) Document database features support ([@huydo862003](https://github.com/huydo862003))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#794](https://github.com/holistics/dbml/pull/794) Add rename table function ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 3
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v5.3.1 (2025-12-23)

#### :robot: Dependencies Update
* `dbml-connector`
  * [#792](https://github.com/holistics/dbml/pull/792) deps(connector): bump snowflake-sdk to 2.3.3 ([@nguyenalter](https://github.com/nguyenalter))
* Other
  * [#790](https://github.com/holistics/dbml/pull/790) chore(deps): bump node-glob to v10.5.0 ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v5.3.0 (2025-12-04)

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`
  * [#785](https://github.com/holistics/dbml/pull/785) Add Oracle database connector ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v5.2.0 (2025-11-19)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#774](https://github.com/holistics/dbml/pull/774) Fix db2dbml not marking composite indexes as primary key ([@huydo862003](https://github.com/huydo862003))
  * [#774](https://github.com/holistics/dbml/pull/774) Fix `fetchSchemaJson` not recognizing primary key fields ([@huydo862003](https://github.com/huydo862003))
* `dbml-core`
  * [#654](https://github.com/holistics/dbml/pull/654) Fix dangling `default:` in DBML export when field default type is invalid ([@Mrxyy](https://github.com/Mrxyy))

#### :rocket: New Feature
* `dbml-core`
  * [#778](https://github.com/holistics/dbml/pull/778) Support dynamic delimiter in mysql parser ([@huydo862003](https://github.com/huydo862003))
* `dbml-cli`, `dbml-core`
  * [#775](https://github.com/holistics/dbml/pull/775) Support OracleSQL importer ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#777](https://github.com/holistics/dbml/pull/777) Support enum as default value ([@huydo862003](https://github.com/huydo862003))

#### :house_with_garden: Internal
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#776](https://github.com/holistics/dbml/pull/776) Setup lint ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))
- Mrxyy ([@Mrxyy](https://github.com/Mrxyy))

## v5.1.0 (2025-10-28)

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`
  * [#766](https://github.com/holistics/dbml/pull/766) Support check constraints in @dbml/connector ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v5.0.0 (2025-10-28)

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#770](https://github.com/holistics/dbml/pull/770) Rename `constraint`/`constraints` keyword to `check`/`checks` ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v4.0.0 (2025-10-23)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#765](https://github.com/holistics/dbml/pull/765) Support check constraint syntax ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#765](https://github.com/holistics/dbml/pull/765) `CONSTRAINT` can no longer be used as a table/column name in PostgreSQL import without quoting ([@huydo862003](https://github.com/huydo862003))

#### Committers: 1
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.14.1 (2025-09-22)

#### :bug: Bug Fix
* `dbml-core`
  * [#759](https://github.com/holistics/dbml/pull/759) Fix Oracle export: place default value before inline constraint ([@huyleminh01](https://github.com/huyleminh01))

#### :robot: Dependencies Update
* [#753](https://github.com/holistics/dbml/pull/753) chore(deps-dev): bump vite from 6.3.5 to 6.3.6 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 1
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))

## v3.14.0 (2025-09-16)

#### :memo: Documentation
* `dbml-cli`
  * [#758](https://github.com/holistics/dbml/pull/758) Update BigQuery connector CLI description on homepage ([@huyleminh01](https://github.com/huyleminh01))
* Other
  * [#746](https://github.com/holistics/dbml/pull/746) Remove inline docs in favor of dbx-rfc ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-parse`
  * [#741](https://github.com/holistics/dbml/pull/741) Add dbml playground and basic RFCs ([@huyphung1602](https://github.com/huyphung1602))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`
  * [#755](https://github.com/holistics/dbml/pull/755) BigQuery ADC (Application Default Credentials) support ([@StephaneBischoffVasco](https://github.com/StephaneBischoffVasco))

#### :robot: Dependencies Update
* [#745](https://github.com/holistics/dbml/pull/745) Bump form-data to fix security issues ([@NQPhuc](https://github.com/NQPhuc))
* [#747](https://github.com/holistics/dbml/pull/747) chore(deps): bump @eslint/plugin-kit from 0.3.3 to 0.3.4 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 5
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Stephane Bischoff ([@StephaneBischoffVasco](https://github.com/StephaneBischoffVasco))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.13.9 (2025-07-22)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#743](https://github.com/holistics/dbml/pull/743) Fix `lodash-es` bundling issue for better tree shaking ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 1
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v3.13.8 (2025-07-22)

#### :robot: Dependencies Update
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#739](https://github.com/holistics/dbml/pull/739) Migrate lodash to lodash-es to reduce bundle size ([@xuantho573](https://github.com/xuantho573))

#### Committers: 1
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.13.7 (2025-07-16)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#738](https://github.com/holistics/dbml/pull/738) Fix builtin data types with uppercase characters being unnecessarily double-quoted in PostgreSQL export ([@xuantho573](https://github.com/xuantho573))

#### :robot: Dependencies Update
* [#737](https://github.com/holistics/dbml/pull/737) chore(deps): bump brace-expansion from 1.1.11 to 1.1.12 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.13.6 (2025-06-19)

#### :memo: Documentation
* [#732](https://github.com/holistics/dbml/pull/732) Docs: Add Scafoldr to Community Contributions ([@DimitrijeGlibic](https://github.com/DimitrijeGlibic))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#735](https://github.com/holistics/dbml/pull/735) Quote column types containing uppercase characters in PostgreSQL export ([@NQPhuc](https://github.com/NQPhuc))

#### :robot: Dependencies Update
* [#733](https://github.com/holistics/dbml/pull/733) Bump express and prismjs to fix vulnerability issues ([@nguyenalter](https://github.com/nguyenalter))
* [#721](https://github.com/holistics/dbml/pull/721) chore(deps): bump snowflake-sdk from 2.0.3 to 2.0.4 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 4
- Dimitrije Glibic ([@DimitrijeGlibic](https://github.com/DimitrijeGlibic))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.13.5 (2025-05-08)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#598](https://github.com/holistics/dbml/pull/598) Fix parser crash on certain column type expressions ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#717](https://github.com/holistics/dbml/pull/717) Fix missing suggestion for ref color ([@xuantho573](https://github.com/xuantho573))

#### Committers: 2
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.13.4 (2025-05-06)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#720](https://github.com/holistics/dbml/pull/720) Fix not handling column type with arguments in TablePartial ([@xuantho573](https://github.com/xuantho573))
* `dbml-core`, `dbml-parse`
  * [#727](https://github.com/holistics/dbml/pull/727) Fix table requiring explicit columns when using partials that already define columns ([@xuantho573](https://github.com/xuantho573))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#728](https://github.com/holistics/dbml/pull/728) Allow unlimited prefix expression in column type with arguments and default values ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.13.2 (2025-05-05)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#657](https://github.com/holistics/dbml/pull/657) Fix db2dbml not including table descriptions for SQL Server ([@MisterGeek](https://github.com/MisterGeek))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- [@MisterGeek](https://github.com/MisterGeek)

## v3.13.1 (2025-04-28)

#### :bug: Bug Fix
* `dbml-core`
  * [#718](https://github.com/holistics/dbml/pull/718) Fix MSSQL parser not recognizing `varchar(max)` and `double precision` types ([@huyleminh01](https://github.com/huyleminh01))

#### :robot: Dependencies Update
* [#694](https://github.com/holistics/dbml/pull/694) chore(deps): bump @babel/runtime-corejs3 from 7.26.0 to 7.27.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#688](https://github.com/holistics/dbml/pull/688) build(deps): bump @babel/runtime from 7.24.4 to 7.26.10 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#695](https://github.com/holistics/dbml/pull/695) chore(deps): bump @babel/helpers from 7.24.5 to 7.27.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#711](https://github.com/holistics/dbml/pull/711) chore(deps): bump http-proxy-middleware from 2.0.7 to 2.0.9 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#701](https://github.com/holistics/dbml/pull/701) chore(deps): bump image-size from 1.1.1 to 1.2.1 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.13.0 (2025-04-24)

#### :memo: Documentation
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#709](https://github.com/holistics/dbml/pull/709) Support TablePartial ([@NQPhuc](https://github.com/NQPhuc))

#### :bug: Bug Fix
* `dbml-connector`
  * [#714](https://github.com/holistics/dbml/pull/714) Fix flaky db2dbml/mssql test caused by inconsistent table ordering ([@NQPhuc](https://github.com/NQPhuc))
* `dbml-core`
  * [#713](https://github.com/holistics/dbml/pull/713) Fix null table when importing PostgreSQL ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#709](https://github.com/holistics/dbml/pull/709) Support TablePartial ([@NQPhuc](https://github.com/NQPhuc))

#### :house_with_garden: Internal
* `dbml-connector`
  * [#714](https://github.com/holistics/dbml/pull/714) Fix flaky db2dbml/mssql test cause by inconsistent table ordering ([@NQPhuc](https://github.com/NQPhuc))
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#708](https://github.com/holistics/dbml/pull/708) Add Eslint and TSConfig ([@xuantho573](https://github.com/xuantho573))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.12.0 (2025-04-08)

#### :memo: Documentation
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#690](https://github.com/holistics/dbml/pull/690) Support parsing INSERT statements from SQL DDL and new MSSQL parser ([@huyleminh01](https://github.com/huyleminh01))
* Other
  * [#702](https://github.com/holistics/dbml/pull/702) Update README.md ([@nielsbosma](https://github.com/nielsbosma))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#690](https://github.com/holistics/dbml/pull/690) Support parsing INSERT statements from SQL DDL and new MSSQL parser ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Niels Bosma ([@nielsbosma](https://github.com/nielsbosma))

## v3.11.0 (2025-04-01)

#### :memo: Documentation
* [#689](https://github.com/holistics/dbml/pull/689) Fix wrong double quote character in docs ([@nguyenalter](https://github.com/nguyenalter))
* [#471](https://github.com/holistics/dbml/pull/471) Add treesitter parser to community tools ([@dynamotn](https://github.com/dynamotn))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`
  * [#692](https://github.com/holistics/dbml/pull/692) Add key pair authentication for Snowflake connector ([@xuantho573](https://github.com/xuantho573))

#### Committers: 4
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))
- Trần Đức Nam ([@dynamotn](https://github.com/dynamotn))

## v3.10.2 (2025-03-03)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#670](https://github.com/holistics/dbml/pull/670) Fix duplicated enums and refs in MSSQL connector ([@huyphung1602](https://github.com/huyphung1602))

#### :robot: Dependencies Update
* [#673](https://github.com/holistics/dbml/pull/673) Bump vite from 4.5.5 to 4.5.6 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.10.1 (2025-02-28)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#683](https://github.com/holistics/dbml/pull/683) Fix incorrect Ref color settings position ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#678](https://github.com/holistics/dbml/pull/678) Support color and name settings for short and long form refs ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 1
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.9.6 (2025-02-20)

#### :bug: Bug Fix
* `dbml-parse`
  * [#677](https://github.com/holistics/dbml/pull/677) Fix tab characters not recognized as whitespace ([@xuantho573](https://github.com/xuantho573))
* `dbml-core`, `dbml-parse`
  * [#679](https://github.com/holistics/dbml/pull/679) Fix `not_null` being set when neither `null` nor `not_null` is specified ([@nguyenalter](https://github.com/nguyenalter))
* `dbml-connector`
  * [#671](https://github.com/holistics/dbml/pull/671) Fix missing FROM-clause entry for table "t" ([@g4b1nagy](https://github.com/g4b1nagy))

#### Committers: 4
- Gabi Nagy ([@g4b1nagy](https://github.com/g4b1nagy))
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.9.5 (2024-12-13)

#### :memo: Documentation
* [#667](https://github.com/holistics/dbml/pull/667) Homepage - Upgrade docusaurus to 3.6.3 ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-core`
  * [#664](https://github.com/holistics/dbml/pull/664) Update type definition for Parser.js ([@nguyenalter](https://github.com/nguyenalter))

#### :robot: Dependencies Update
* [#667](https://github.com/holistics/dbml/pull/667) Homepage - Upgrade docusaurus to 3.6.3 ([@huyleminh01](https://github.com/huyleminh01))
* [#640](https://github.com/holistics/dbml/pull/640) Bump vite from 4.5.3 to 4.5.5 ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#643](https://github.com/holistics/dbml/pull/643) Bump rollup from 3.29.4 to 3.29.5 ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#665](https://github.com/holistics/dbml/pull/665) Bump nanoid from 3.3.6 to 3.3.8 ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#666](https://github.com/holistics/dbml/pull/666) Bump nanoid from 3.3.7 to 3.3.8 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#651](https://github.com/holistics/dbml/pull/651) Bump http-proxy-middleware from 2.0.6 to 2.0.7 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#662](https://github.com/holistics/dbml/pull/662) Bump cross-spawn from 7.0.3 to 7.0.6 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))

## v3.9.4 (2024-12-05)

#### :bug: Bug Fix
* `dbml-connector`
  * [#660](https://github.com/holistics/dbml/pull/660) Fix db2dbml BigQuery connector query ([@kenzht](https://github.com/kenzht))

#### :robot: Dependencies Update
* [#661](https://github.com/holistics/dbml/pull/661) Bump cross-spawn from 7.0.3 to 7.0.6 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- [@kenzht](https://github.com/kenzht)

## v3.9.3 (2024-10-30)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#650](https://github.com/holistics/dbml/pull/650) Fix connector not preserving table ordinal position ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.9.2 (2024-10-15)

#### :bug: Bug Fix
* `dbml-core`
  * [#647](https://github.com/holistics/dbml/pull/647) Fix ModelExporter not exporting sticky notes, table group notes, and color ([@thonx-holistics](https://github.com/thonx-holistics))

#### Committers: 1
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))

## v3.9.1 (2024-10-14)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#645](https://github.com/holistics/dbml/pull/645) Fix mssql connector - Missing data type size for numeric-based and string-based columns ([@huyleminh01](https://github.com/huyleminh01))
* `dbml-core`
  * [#646](https://github.com/holistics/dbml/pull/646) Fix ModelExporter not exporting `<>` refs in DBML ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.9.0 (2024-09-13)

#### :bug: Bug Fix
* `dbml-parse`
  * [#632](https://github.com/holistics/dbml/pull/632) Upgrade vite-plugin-dts and fix tsconfig to properly include all sources ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-core`, `dbml-parse`
  * [#594](https://github.com/holistics/dbml/pull/594) Remove support for escaping triple quotes (`\'\'\'`) inside triple-quoted strings ([@huydo862003](https://github.com/huydo862003))

#### :robot: Dependencies Update
* Other
  * [#625](https://github.com/holistics/dbml/pull/625) Bump micromatch from 4.0.5 to 4.0.8 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#628](https://github.com/holistics/dbml/pull/628) Bump webpack from 5.91.0 to 5.94.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#637](https://github.com/holistics/dbml/pull/637) Bump express from 4.19.2 to 4.21.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* `dbml-parse`
  * [#632](https://github.com/holistics/dbml/pull/632) Upgrade vite-plugin-dts and fix tsconfig to properly include all sources ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.8.1 (2024-09-11)

#### :memo: Documentation
* [#627](https://github.com/holistics/dbml/pull/627) Docs - Update doc for bigquery and snowflake connector ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#634](https://github.com/holistics/dbml/pull/634) Fix PostgreSQL connector issues ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-core`
  * [#629](https://github.com/holistics/dbml/pull/629) Fix `Parser.parse` type definition to accept `RawDatabase` when format is `json` ([@Mrxyy](https://github.com/Mrxyy))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Mrxyy ([@Mrxyy](https://github.com/Mrxyy))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.8.0 (2024-08-27)

#### :memo: Documentation
* `dbml-core`
  * [#624](https://github.com/holistics/dbml/pull/624) Fix erroneous examples in document for Table Groups ([@thonx-holistics](https://github.com/thonx-holistics))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`
  * [#622](https://github.com/holistics/dbml/pull/622) Add bigquery connector ([@huyleminh01](https://github.com/huyleminh01))
* `dbml-cli`, `dbml-connector`, `dbml-core`
  * [#623](https://github.com/holistics/dbml/pull/623) Add Snowflake connector ([@huyphung1602](https://github.com/huyphung1602))

#### :robot: Dependencies Update
* [#621](https://github.com/holistics/dbml/pull/621) Bump micromatch from 4.0.5 to 4.0.8 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.7.4 (2024-08-26)

#### :memo: Documentation
* `dbml-core`, `dbml-parse`
  * [#619](https://github.com/holistics/dbml/pull/619) Support colors for Table Groups ([@thonx-holistics](https://github.com/thonx-holistics))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#619](https://github.com/holistics/dbml/pull/619) Support colors for Table Groups ([@thonx-holistics](https://github.com/thonx-holistics))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))

## v3.7.3 (2024-08-19)

#### :memo: Documentation
* `dbml-connector`, `dbml-core`
  * [#617](https://github.com/holistics/dbml/pull/617) Update readme for dbml core and connector ([@huyleminh01](https://github.com/huyleminh01))
* Other
  * [#615](https://github.com/holistics/dbml/pull/615) Docs - Add document for connector ([@huyleminh01](https://github.com/huyleminh01))
  * [#614](https://github.com/holistics/dbml/pull/614) Add syntax manuals for table group notes ([@TeaNguyen](https://github.com/TeaNguyen))

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#616](https://github.com/holistics/dbml/pull/616) Fix wrong suggestion behaviors for Table Groups ([@thonx-holistics](https://github.com/thonx-holistics))
* `dbml-parse`
  * [#606](https://github.com/holistics/dbml/pull/606) Fix incorrect token position for indexes in parsed output ([@huydo862003](https://github.com/huydo862003))

#### Committers: 4
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Thi Nguyen ([@TeaNguyen](https://github.com/TeaNguyen))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.7.2 (2024-08-14)

#### :memo: Documentation
* [#605](https://github.com/holistics/dbml/pull/605) Docs - Add document for database connector ([@huyleminh01](https://github.com/huyleminh01))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`
  * [#611](https://github.com/holistics/dbml/pull/611) Add @dbml/connector ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-core`, `dbml-parse`
  * [#601](https://github.com/holistics/dbml/pull/601) Support notes for table group ([@thonx-holistics](https://github.com/thonx-holistics))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.7.1 (2024-08-13)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#609](https://github.com/holistics/dbml/pull/609) Clean build cache and require Node 18 or higher ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 1
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))

## v3.7.0 (2024-08-12)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#596](https://github.com/holistics/dbml/pull/596) Add database connectors ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.6.2 (2024-07-31)

#### :running_woman: Performance
* `dbml-core`
  * [#590](https://github.com/holistics/dbml/pull/590) Improve DBML normalize performance ([@thonx-holistics](https://github.com/thonx-holistics))

#### :house_with_garden: Internal
* `dbml-parse`
  * [#592](https://github.com/holistics/dbml/pull/592) chore: config vite to gen .d.ts file on build ([@huydo862003](https://github.com/huydo862003))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.6.1 (2024-07-23)

#### :bug: Bug Fix
* `dbml-parse`
  * [#588](https://github.com/holistics/dbml/pull/588) Fix autocompletion crash when attribute name is blank ([@huydo862003](https://github.com/huydo862003))

#### :robot: Dependencies Update
* [#583](https://github.com/holistics/dbml/pull/583) build(deps): bump ws from 7.5.9 to 7.5.10 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.6.0 (2024-07-17)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#587](https://github.com/holistics/dbml/pull/587) Snowflake DDL Importer ([@huyphung1602](https://github.com/huyphung1602))

#### :robot: Dependencies Update
* [#581](https://github.com/holistics/dbml/pull/581) build(deps): bump braces from 3.0.2 to 3.0.3 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#582](https://github.com/holistics/dbml/pull/582) build(deps): bump braces from 3.0.2 to 3.0.3 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.5.1 (2024-06-11)

#### :bug: Bug Fix
* `dbml-parse`
  * [#579](https://github.com/holistics/dbml/pull/579) Fix/silent errors in compiler api stack container ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.5.0 (2024-06-04)

#### :memo: Documentation
* [#571](https://github.com/holistics/dbml/pull/571) Migrate - Remove old hompepage and rename docs folder to homepage ([@huyleminh01](https://github.com/huyleminh01))
* [#570](https://github.com/holistics/dbml/pull/570) Fix - Rename file syntax to docs to keep old route ([@huyleminh01](https://github.com/huyleminh01))
* [#568](https://github.com/holistics/dbml/pull/568) Docs - Migrate dbml homepage to docusaurus ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-parse`
  * [#575](https://github.com/holistics/dbml/pull/575) Fix/remove tablegroup in schema ([@huydo862003](https://github.com/huydo862003))

#### :rocket: New Feature
* `dbml-core`
  * [#574](https://github.com/holistics/dbml/pull/574) Export @dbml/core version ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.4.3 (2024-04-26)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#563](https://github.com/holistics/dbml/pull/563) Properly indent indexes in table ([@pierresouchay](https://github.com/pierresouchay))
* `dbml-core`, `dbml-parse`
  * [#564](https://github.com/holistics/dbml/pull/564) Fix/add token to index column ([@huydo862003](https://github.com/huydo862003))

#### :robot: Dependencies Update
* `dbml-parse`
  * [#554](https://github.com/holistics/dbml/pull/554) build(deps): bump ip from 2.0.0 to 2.0.1 ([@dependabot[bot]](https://github.com/apps/dependabot))
* Other
  * [#557](https://github.com/holistics/dbml/pull/557) build(deps): bump axios from 1.3.4 to 1.6.8 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 3
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.4.2 (2024-04-25)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#561](https://github.com/holistics/dbml/pull/561) parse/fix/throw undefined at primary expression ([@huydo862003](https://github.com/huydo862003))
* `dbml-cli`, `dbml-core`
  * [#549](https://github.com/holistics/dbml/pull/549) Properly handle unique and PK constraints in PostgreSQL ALTER TABLE statements ([@pierresouchay](https://github.com/pierresouchay))

#### :robot: Dependencies Update
* [#552](https://github.com/holistics/dbml/pull/552) build(deps-dev): bump vite from 4.5.0 to 4.5.3 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 3
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.4.1 (2024-04-16)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#543](https://github.com/holistics/dbml/pull/543) parse/trim note top empty lines ([@huydo862003](https://github.com/huydo862003))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#547](https://github.com/holistics/dbml/pull/547) Add project's token into interpreter result ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-parse`
  * [#535](https://github.com/holistics/dbml/pull/535) Support continuation mark and catch invalid escape sequence ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`
  * [#541](https://github.com/holistics/dbml/pull/541) Parser now throws a consistent error class with structured diagnostics ([@huydo862003](https://github.com/huydo862003))

#### Committers: 3
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.4.0 (2024-03-19)

#### :bug: Bug Fix
* `dbml-parse`
  * [#539](https://github.com/holistics/dbml/pull/539) Fix project note content not being normalized ([@huydo862003](https://github.com/huydo862003))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#534](https://github.com/holistics/dbml/pull/534) New feature: Export DBML to Oracle version 19c ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.3.0 (2024-03-19)

#### :memo: Documentation
* [#533](https://github.com/holistics/dbml/pull/533) Add Sticky Notes syntax guide and a new community contribution ([@huyphung1602](https://github.com/huyphung1602))
* [#529](https://github.com/holistics/dbml/pull/529) Add contributor dbml java ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#536](https://github.com/holistics/dbml/pull/536) Normalize note content for user-friendly markdown rendering ([@huydo862003](https://github.com/huydo862003))
* `dbml-parse`
  * [#526](https://github.com/holistics/dbml/pull/526) Parser/fix `getRefId` ([@huydo862003](https://github.com/huydo862003))

#### :rocket: New Feature
* `dbml-parse`
  * [#521](https://github.com/holistics/dbml/pull/521) Parser/support non ascii letters in identifiers ([@huydo862003](https://github.com/huydo862003))

#### Committers: 4
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.2.0 (2024-02-26)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#500](https://github.com/holistics/dbml/pull/500) Support sticky note syntaxes ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 1
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.1.8 (2024-02-21)

#### :bug: Bug Fix
* `dbml-parse`
  * [#524](https://github.com/holistics/dbml/pull/524) Fix unquoted `update` and `delete` ref settings not being parsed (e.g. `[update: set default, delete: set null]`) ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.1.7 (2024-02-20)

#### :bug: Bug Fix
* `dbml-parse`
  * [#522](https://github.com/holistics/dbml/pull/522) Parser/interpret ref on update ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.1.6 (2024-02-20)

#### :memo: Documentation
* [#512](https://github.com/holistics/dbml/pull/512) Add contribution for DB2Code ([@NQPhuc](https://github.com/NQPhuc))

#### :bug: Bug Fix
* `dbml-parse`
  * [#519](https://github.com/holistics/dbml/pull/519) Remove ref in table syntax ([@huydo862003](https://github.com/huydo862003))
  * [#518](https://github.com/holistics/dbml/pull/518) Add check for table reappear in tablegroups ([@huydo862003](https://github.com/huydo862003))
  * [#515](https://github.com/holistics/dbml/pull/515) Fix validate when redundant args & `getMemberChain` ([@huydo862003](https://github.com/huydo862003))
  * [#517](https://github.com/holistics/dbml/pull/517) Fix circular ref ([@huydo862003](https://github.com/huydo862003))
* `dbml-core`
  * [#503](https://github.com/holistics/dbml/pull/503) Properly escape notes with newlines ([@pierresouchay](https://github.com/pierresouchay))

#### :boom: Breaking Change
* `dbml-parse`
  * [#519](https://github.com/holistics/dbml/pull/519) Remove ref in table syntax ([@huydo862003](https://github.com/huydo862003))

#### Committers: 3
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.1.5 (2024-02-06)

#### :bug: Bug Fix
* `dbml-parse`
  * [#510](https://github.com/holistics/dbml/pull/510) Support identifiers starting with numbers ([@huydo862003](https://github.com/huydo862003))
  * [#509](https://github.com/holistics/dbml/pull/509) Fix internal parser errors on certain element structures ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- HuyDNA ([@huydo862003](https://github.com/huydo862003))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.1.4 (2024-02-05)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#507](https://github.com/holistics/dbml/pull/507) Fix 1-1 foreign key endpoints being swapped in inline refs ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- HuyDNA ([@huydo862003](https://github.com/huydo862003))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.1.3 (2024-02-01)

#### :bug: Bug Fix
* `dbml-parse`
  * [#504](https://github.com/holistics/dbml/pull/504) Fix/dbml alias & primary key & note content bug ([@huydo862003](https://github.com/huydo862003))

#### Committers: 2
- HuyDNA ([@huydo862003](https://github.com/huydo862003))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v3.1.2 (2024-01-24)

#### :memo: Documentation
* `dbml-parse`
  * [#498](https://github.com/holistics/dbml/pull/498) Support strings and identifiers in column caller type ([@huydo862003](https://github.com/huydo862003))

#### :bug: Bug Fix
* `dbml-core`
  * [#493](https://github.com/holistics/dbml/pull/493) Properly escape notes containing single quotes in sql2dbml ([@pierresouchay](https://github.com/pierresouchay))
* `dbml-parse`
  * [#498](https://github.com/holistics/dbml/pull/498) Support strings and identifiers in column caller type ([@huydo862003](https://github.com/huydo862003))

#### Committers: 3
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v3.1.1 (2024-01-18)

#### :bug: Bug Fix
* Fix wrong casing file names in published package

## v3.1.0 (2024-01-18)

#### :memo: Documentation
* [#479](https://github.com/holistics/dbml/pull/479) Update README ([@matthewjumpsoffbuildings](https://github.com/matthewjumpsoffbuildings))

#### :bug: Bug Fix
* `dbml-core`
  * [#487](https://github.com/holistics/dbml/pull/487) Fix note field with string value not displaying ([@Mrxyy](https://github.com/Mrxyy))
* `dbml-cli`, `dbml-parse`
  * [#488](https://github.com/holistics/dbml/pull/488) Fix new DBML parser inconsistencies ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#486](https://github.com/holistics/dbml/pull/486) Add Mysql ANTLR4 parser ([@NQPhuc](https://github.com/NQPhuc))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`
  * [#486](https://github.com/holistics/dbml/pull/486) Add Mysql ANTLR4 parser ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 3
- Matthew ([@matthewjumpsoffbuildings](https://github.com/matthewjumpsoffbuildings))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- jaden ([@Mrxyy](https://github.com/Mrxyy))

## v3.0.0 (2023-11-23)

#### :bug: Bug Fix
* `dbml-core`
  * [#477](https://github.com/holistics/dbml/pull/477) Fix: Export note string and default value ([@nguyenalter](https://github.com/nguyenalter))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#458](https://github.com/holistics/dbml/pull/458) Alternative dbml parser ([@huydo862003](https://github.com/huydo862003))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#458](https://github.com/holistics/dbml/pull/458) Alternative dbml parser ([@huydo862003](https://github.com/huydo862003))

#### :robot: Dependencies Update
* [#469](https://github.com/holistics/dbml/pull/469) Bump browserify-sign from 4.0.4 to 4.2.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#451](https://github.com/holistics/dbml/pull/451) Bump fsevents from 1.2.9 to 1.2.13 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#464](https://github.com/holistics/dbml/pull/464) Bump @babel/traverse from 7.21.4 to 7.23.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#463](https://github.com/holistics/dbml/pull/463) Bump @babel/traverse from 7.21.4 to 7.23.2 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 4
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Vinh Ho ([@vinh-hh](https://github.com/vinh-hh))
- Huy Do Nguyen An ([@huydo862003](https://github.com/huydo862003))

## v2.6.1 (2023-10-16)

#### :memo: Documentation
* [#437](https://github.com/holistics/dbml/pull/437) Update CLI documentation about postgres-legacy option ([@NQPhuc](https://github.com/NQPhuc))

#### :bug: Bug Fix
* `dbml-core`
  * [#460](https://github.com/holistics/dbml/pull/460) Fix comment syntax in MySQL parser ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v2.6.0 (2023-09-06)

#### :memo: Documentation
* [#426](https://github.com/holistics/dbml/pull/426) docs: Update the example of table users in README.md ([@huyphung1602](https://github.com/huyphung1602))
* [#417](https://github.com/holistics/dbml/pull/417) Included enum example for names with spaces ([@jacobtread](https://github.com/jacobtread))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#416](https://github.com/holistics/dbml/pull/416) Add antlr grammar and visitor for postgresql ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#416](https://github.com/holistics/dbml/pull/416) Add antlr grammar and visitor for postgresql ([@NQPhuc](https://github.com/NQPhuc))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`
  * [#416](https://github.com/holistics/dbml/pull/416) Add antlr grammar and visitor for postgresql ([@NQPhuc](https://github.com/NQPhuc))

#### :house_with_garden: Internal
* [#433](https://github.com/holistics/dbml/pull/433) change(bearer_workflows): only scan pr diff ([@vinh-hh](https://github.com/vinh-hh))
* [#429](https://github.com/holistics/dbml/pull/429) update fail on error bearer scan ([@vinh-hh](https://github.com/vinh-hh))
* [#428](https://github.com/holistics/dbml/pull/428) feat(github): add bearer scan ([@vinh-hh](https://github.com/vinh-hh))

#### Committers: 7
- Jacobtread ([@jacobtread](https://github.com/jacobtread))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Vinh Ho ([@vinh-hh](https://github.com/vinh-hh))
- chrstfer ([@chrstfer](https://github.com/chrstfer))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- shyam ([@xshyamx](https://github.com/xshyamx))

## v2.5.4 (2023-07-18)

#### :memo: Documentation
* `dbml-cli`, `dbml-core`
  * [#397](https://github.com/holistics/dbml/pull/397) Update dbml domain ([@nguyenalter](https://github.com/nguyenalter))
* Other
  * [#396](https://github.com/holistics/dbml/pull/396) Update new domain for dbml homepage ([@TeaNguyen](https://github.com/TeaNguyen))

#### :bug: Bug Fix
* `dbml-core`
  * [#406](https://github.com/holistics/dbml/pull/406) Fix default values for MS-SQL parser ([@bobzomer](https://github.com/bobzomer))

#### :house_with_garden: Internal
* [#398](https://github.com/holistics/dbml/pull/398) Add missing step in build-docs workflow ([@nguyenalter](https://github.com/nguyenalter))
* [#366](https://github.com/holistics/dbml/pull/366) Add build-docs workflow ([@nguyenalter](https://github.com/nguyenalter))

#### :robot: Dependencies Update
* `dbml-cli`, `dbml-core`
  * [#411](https://github.com/holistics/dbml/pull/411) Upgrade lerna to v7 ([@nguyenalter](https://github.com/nguyenalter))
* `dbml-cli`
  * [#410](https://github.com/holistics/dbml/pull/410) Fix vulnerable deps ([@nguyenalter](https://github.com/nguyenalter))
  * [#400](https://github.com/holistics/dbml/pull/400) Bump hosted-git-info from 2.8.4 to 2.8.9 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#392](https://github.com/holistics/dbml/pull/392) Bump path-parse from 1.0.6 to 1.0.7 ([@dependabot[bot]](https://github.com/apps/dependabot))
* Other
  * [#409](https://github.com/holistics/dbml/pull/409) Bump semver from 5.7.1 to 5.7.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#399](https://github.com/holistics/dbml/pull/399) Bump browserslist from 4.7.1 to 4.21.5 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#235](https://github.com/holistics/dbml/pull/235) Bump ajv from 6.10.2 to 6.12.6 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#382](https://github.com/holistics/dbml/pull/382) Bump postcss from 7.0.18 to 7.0.39 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#394](https://github.com/holistics/dbml/pull/394) Fix nth-check security issues in /dbml-homepage ([@nguyenalter](https://github.com/nguyenalter))
  * [#393](https://github.com/holistics/dbml/pull/393) Force glob-parent to 5.1.2 in /dbml-homepage ([@nguyenalter](https://github.com/nguyenalter))
  * [#389](https://github.com/holistics/dbml/pull/389) Bump vuepress to 1.9.9 in /dbml-homepage  ([@nguyenalter](https://github.com/nguyenalter))
  * [#390](https://github.com/holistics/dbml/pull/390) Force selfsigned to 2.1.1, bump postcss-svgo to 4.0.3 in /dbml-homepage ([@nguyenalter](https://github.com/nguyenalter))
  * [#387](https://github.com/holistics/dbml/pull/387) Force loader-utils to 1.4.2 and bump json5 ([@nguyenalter](https://github.com/nguyenalter))
  * [#386](https://github.com/holistics/dbml/pull/386) Bump express, kind-of, vue and webpack plugins in /dbml-homepage ([@nguyenalter](https://github.com/nguyenalter))
  * [#385](https://github.com/holistics/dbml/pull/385) Bump dot-prop from 4.2.0 to 4.2.1 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#383](https://github.com/holistics/dbml/pull/383) Bump webpack-dev-server from 3.9.0 to 3.11.3 in /dbml-homepage ([@nguyenalter](https://github.com/nguyenalter))
  * [#379](https://github.com/holistics/dbml/pull/379) Bump ansi-regex, jsprim, loader-utils and minimist in /dbml-homepage ([@nguyenalter](https://github.com/nguyenalter))
  * [#381](https://github.com/holistics/dbml/pull/381) Bump y18n from 4.0.0 to 4.0.3 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#380](https://github.com/holistics/dbml/pull/380) Bump acorn from 6.3.0 to 6.4.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#103](https://github.com/holistics/dbml/pull/103) Bump websocket-extensions from 0.1.3 to 0.1.4 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#132](https://github.com/holistics/dbml/pull/132) Bump http-proxy from 1.18.0 to 1.18.1 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#162](https://github.com/holistics/dbml/pull/162) Bump elliptic from 6.5.1 to 6.5.4 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#184](https://github.com/holistics/dbml/pull/184) Bump dns-packet from 1.3.1 to 1.3.4 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#378](https://github.com/holistics/dbml/pull/378) Bump ini from 1.3.5 to 1.3.8 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#170](https://github.com/holistics/dbml/pull/170) Bump ssri from 6.0.1 to 6.0.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#267](https://github.com/holistics/dbml/pull/267) Bump async from 2.6.3 to 2.6.4 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#309](https://github.com/holistics/dbml/pull/309) Bump decode-uri-component from 0.2.0 to 0.2.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* `dbml-core`
  * [#408](https://github.com/holistics/dbml/pull/408) Bump semver from 5.7.1 to 5.7.2 in /packages/dbml-core ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 4
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Thi Nguyen ([@TeaNguyen](https://github.com/TeaNguyen))
- [@bobzomer](https://github.com/bobzomer)
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v2.5.3 (2023-04-17)

#### :running_woman: Performance
* [#349](https://github.com/holistics/dbml/pull/349) Remove redundant build step ([@nguyenalter](https://github.com/nguyenalter))

#### :house_with_garden: Internal
* Other
  * [#374](https://github.com/holistics/dbml/pull/374) Internal: add dependencies update label ([@nguyenalter](https://github.com/nguyenalter))
* `dbml-cli`
  * [#348](https://github.com/holistics/dbml/pull/348) Remove package lock files ([@nguyenalter](https://github.com/nguyenalter))

#### :robot: Dependencies Update
* `dbml-cli`
  * [#372](https://github.com/holistics/dbml/pull/372) Bump ansi-regex from 4.1.0 to 4.1.1 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#371](https://github.com/holistics/dbml/pull/371) Bump glob-parent from 5.1.0 to 5.1.2 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#370](https://github.com/holistics/dbml/pull/370) Bump kind-of from 6.0.2 to 6.0.3 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#369](https://github.com/holistics/dbml/pull/369) Bump eslint to 6.8.0 and mkdirp to 0.5.6 ([@nguyenalter](https://github.com/nguyenalter))
  * [#363](https://github.com/holistics/dbml/pull/363) Bump ini from 1.3.5 to 1.3.8 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#362](https://github.com/holistics/dbml/pull/362) Bump acorn from 5.7.3 to 5.7.4 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#361](https://github.com/holistics/dbml/pull/361) Bump tar from 4.4.13 to 4.4.19 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#360](https://github.com/holistics/dbml/pull/360) Bump async from 2.6.3 to 2.6.4 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#358](https://github.com/holistics/dbml/pull/358) Bump tmpl from 1.0.4 to 1.0.5 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#359](https://github.com/holistics/dbml/pull/359) Bump minimatch from 3.0.4 to 3.1.2 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#357](https://github.com/holistics/dbml/pull/357) Bump y18n from 4.0.0 to 4.0.3 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#350](https://github.com/holistics/dbml/pull/350) Bump handlebars from 4.3.4 to 4.7.7 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#177](https://github.com/holistics/dbml/pull/177) Bump lodash from 4.17.15 to 4.17.21 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#346](https://github.com/holistics/dbml/pull/346) Bump json5 from 2.1.0 to 2.2.3 in /packages/dbml-cli ([@dependabot[bot]](https://github.com/apps/dependabot))
* `dbml-cli`, `dbml-core`
  * [#368](https://github.com/holistics/dbml/pull/368) Bump babel packages to the latest version ([@nguyenalter](https://github.com/nguyenalter))
  * [#365](https://github.com/holistics/dbml/pull/365) Bump jest and babel-jest to v29.5.0 ([@nguyenalter](https://github.com/nguyenalter))
* Other
  * [#367](https://github.com/holistics/dbml/pull/367) Bump lodash to v4.17.21 ([@nguyenalter](https://github.com/nguyenalter))
  * [#356](https://github.com/holistics/dbml/pull/356) Bump minimatch from 3.0.4 to 3.1.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#364](https://github.com/holistics/dbml/pull/364) Bump ini from 1.3.5 to 1.3.8 ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#243](https://github.com/holistics/dbml/pull/243) Bump url-parse from 1.4.7 to 1.5.10 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#313](https://github.com/holistics/dbml/pull/313) Bump qs from 6.5.2 to 6.5.3 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#207](https://github.com/holistics/dbml/pull/207) Bump tar from 4.4.13 to 4.4.19 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#179](https://github.com/holistics/dbml/pull/179) Bump lodash from 4.17.15 to 4.17.21 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#347](https://github.com/holistics/dbml/pull/347) Bump prismjs from 1.17.1 to 1.29.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#275](https://github.com/holistics/dbml/pull/275) Bump terser from 4.3.9 to 4.8.1 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#325](https://github.com/holistics/dbml/pull/325) Bump http-cache-semantics, lerna and lerna-changelog ([@dependabot[bot]](https://github.com/apps/dependabot))
* `dbml-core`
  * [#178](https://github.com/holistics/dbml/pull/178) Bump lodash from 4.17.15 to 4.17.21 in /packages/dbml-core ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#355](https://github.com/holistics/dbml/pull/355) Bump y18n from 4.0.0 to 4.0.3 in /packages/dbml-core ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#354](https://github.com/holistics/dbml/pull/354) Bump minimatch from 3.0.4 to 3.1.2 in /packages/dbml-core ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 1
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v2.5.2 (2023-03-27)
#### :robot: Dependabot security fixes
- [#339](https://github.com/holistics/dbml/pull/339), [#334](https://github.com/holistics/dbml/pull/334), [#202](https://github.com/holistics/dbml/pull/202)
#### :bug: Bug Fix
* `dbml-core`
  * [#342](https://github.com/holistics/dbml/pull/342) Rendering schema name for table comments ([@mhueck](https://github.com/mhueck))

#### Committers: 1
- Markus Hueck ([@mhueck](https://github.com/mhueck))

## v2.5.1 (2023-02-17)
#### :robot: Dependabot security fixes
- [#330](https://github.com/holistics/dbml/pull/330), [#319](https://github.com/holistics/dbml/pull/319), [#318](https://github.com/holistics/dbml/pull/318), [#317](https://github.com/holistics/dbml/pull/317), [#314](https://github.com/holistics/dbml/pull/314), [#310](https://github.com/holistics/dbml/pull/310), [#293](https://github.com/holistics/dbml/pull/293), [#258](https://github.com/holistics/dbml/pull/258), [#236](https://github.com/holistics/dbml/pull/236), [#234](https://github.com/holistics/dbml/pull/234), [#211](https://github.com/holistics/dbml/pull/211)
#### :running_woman: Performance
* [#328](https://github.com/holistics/dbml/pull/328) Init CI test ([@nguyenalter](https://github.com/nguyenalter))

#### :memo: Documentation
* [#329](https://github.com/holistics/dbml/pull/329) Update dbml syntax docs ([@huyphung1602](https://github.com/huyphung1602))

#### :house_with_garden: Internal
* `dbml-cli`, `dbml-core`
  * [#327](https://github.com/holistics/dbml/pull/327) Improve duplicate endpoints error message ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 2
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v2.5.0 (2023-02-07)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#300](https://github.com/holistics/dbml/pull/300) Add token for note ([@nguyenalter](https://github.com/nguyenalter))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`
  * [#300](https://github.com/holistics/dbml/pull/300) Add token for note ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 1
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v2.4.4 (2022-11-08)

#### :bug: Bug Fix
* `dbml-core`
  * [#297](https://github.com/holistics/dbml/pull/297) Ignore on update current timestamp in mysql ([@baolequoc](https://github.com/baolequoc))
  * [#295](https://github.com/holistics/dbml/pull/295) Update type when setting increment ([@baolequoc](https://github.com/baolequoc))
  * [#296](https://github.com/holistics/dbml/pull/296) Fix missing space when creating index ([@baolequoc](https://github.com/baolequoc))

#### Committers: 1
- [@baolequoc](https://github.com/baolequoc)

## v2.4.3 (2022-10-13)

#### :bug: Bug Fix
* `dbml-core`
  * [#273](https://github.com/holistics/dbml/pull/273) Support SMALLSERIAL type for export postgresSQL ([@baolequoc](https://github.com/baolequoc))
* `dbml-core`
  * [#274](https://github.com/holistics/dbml/pull/274) Support shorthand foreign key references  ([@nguyenalter](https://github.com/nguyenalter))
* `dbml-core`
  * [#283](https://github.com/holistics/dbml/pull/283) Support schema name for the junction table of many-to-many relationship  ([@baolequoc](https://github.com/baolequoc))
* `dbml-core`
  * [#291](https://github.com/holistics/dbml/pull/291) Support timestamptz and timetz type for import postgresSQL  ([@baolequoc](https://github.com/baolequoc))
#### Committers: 2
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- [@baolequoc](https://github.com/baolequoc)



## v2.4.2 (2022-06-02)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#262](https://github.com/holistics/dbml/pull/262) Support many to many relationship ([@baolequoc](https://github.com/baolequoc))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- [@baolequoc](https://github.com/baolequoc)

## v2.4.1 (2022-04-26)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#256](https://github.com/holistics/dbml/pull/256) Ignore unsupported Posgrest ALTER commands ([@NQPhuc](https://github.com/NQPhuc))
* `dbml-core`
  * [#257](https://github.com/holistics/dbml/pull/257) Ignore unsupported Mysql ALTER commands  ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#252](https://github.com/holistics/dbml/pull/252) Support import comment for MySQL, PostgreSQL and MSSQL ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v2.4 (2022-03-08)

#### :memo: Documentation
* [#226](https://github.com/holistics/dbml/pull/226) Update README.md ([@noakesey](https://github.com/noakesey))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#240](https://github.com/holistics/dbml/pull/240) Support multiple schemas ([@NQPhuc](https://github.com/NQPhuc))
* `dbml-cli`
  * [#209](https://github.com/holistics/dbml/pull/209) Add --mssql option for sql2dbml CLI ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#240](https://github.com/holistics/dbml/pull/240) Support multiple schemas ([@NQPhuc](https://github.com/NQPhuc))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`
  * [#240](https://github.com/holistics/dbml/pull/240) Support multiple schemas ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 4
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Paul Noakes ([@noakesey](https://github.com/noakesey))
- Thi Nguyen ([@TeaNguyen](https://github.com/TeaNguyen))

## v2.3.1 (2021-07-26)

#### :bug: Bug Fix
* `dbml-core`
  * [#192](https://github.com/holistics/dbml/pull/192) Dbml core/support postgres array and fix mysql bugs ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-core`
  * [#192](https://github.com/holistics/dbml/pull/192) Dbml core/support postgres array and fix mysql bugs ([@NQPhuc](https://github.com/NQPhuc))
  * [#189](https://github.com/holistics/dbml/pull/189) Add multiline comment ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 1
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v2.3.0 (2021-01-04)

#### :rocket: New Feature
* `dbml-core`
  * [#151](https://github.com/holistics/dbml/pull/151) Add dbml-core type definitions ([@JacobHearst](https://github.com/JacobHearst))

#### Committers: 1
- Jacob Hearst ([@JacobHearst](https://github.com/JacobHearst))

## v2.2.0 (2020-12-30)

#### :memo: Documentation
* `dbml-cli`, `dbml-core`
  * [#108](https://github.com/holistics/dbml/pull/108) Update readme and bump version ([@khanh-tran-quoc](https://github.com/khanh-tran-quoc))

#### :bug: Bug Fix
* `dbml-core`
  * [#111](https://github.com/holistics/dbml/pull/111) Fix export table note ([@khanhtmn](https://github.com/khanhtmn))
  * [#102](https://github.com/holistics/dbml/pull/102) Fix endpoint error handling and support for implicit foreign key reference for mssql ([@phanbaominh](https://github.com/phanbaominh))

#### :rocket: New Feature
* `dbml-core`
  * [#150](https://github.com/holistics/dbml/pull/150) Support parse time data type. ([@t-duc](https://github.com/t-duc))
  * [#131](https://github.com/holistics/dbml/pull/131) [Enhancement]support symbol for mysql importer ([@khoahuynhdev](https://github.com/khoahuynhdev))
  * [#102](https://github.com/holistics/dbml/pull/102) Fix endpoint error handling and support for implicit foreign key reference for mssql ([@phanbaominh](https://github.com/phanbaominh))

#### Committers: 5
- Duc ([@t-duc](https://github.com/t-duc))
- Khanh Thuy Mai Nguyen ([@khanhtmn](https://github.com/khanhtmn))
- Khoa Huỳnh ([@khoahuynhdev](https://github.com/khoahuynhdev))
- Phan Bao Minh ([@phanbaominh](https://github.com/phanbaominh))
- [@khanh-tran-quoc](https://github.com/khanh-tran-quoc)


## v2.1.0 (2020-06-05)

#### :memo: Documentation
* [#101](https://github.com/holistics/dbml/pull/101) Update homepage ([@phuongduyphan](https://github.com/phuongduyphan))
* [#93](https://github.com/holistics/dbml/pull/93) Add golang parser to community contributes ([@duythinht](https://github.com/duythinht))
* [#92](https://github.com/holistics/dbml/pull/92) Add PyDBML to dbml homepage ([@phuongduyphan](https://github.com/phuongduyphan))
* [#91](https://github.com/holistics/dbml/pull/91) Add FloorPlan to community contributions ([@julioz](https://github.com/julioz))
* [#89](https://github.com/holistics/dbml/pull/89) Add PyDBML to Comunity Contributions section of README ([@Vanderhoof](https://github.com/Vanderhoof))
* [#86](https://github.com/holistics/dbml/pull/86) fixes contributing setup section : yarn must be present to run 'lerna bootstrap' ([@sporniket](https://github.com/sporniket))

#### :rocket: New Feature
* `dbml-core`
  * [#98](https://github.com/holistics/dbml/pull/98) Add mssql parser ([@phanbaominh](https://github.com/phanbaominh))
  * [#99](https://github.com/holistics/dbml/pull/99) Support exporting table's note ([@khanhtmn](https://github.com/khanhtmn))
  * [#95](https://github.com/holistics/dbml/pull/95) Support field-level charset in MySQL parser ([@Orclyx](https://github.com/Orclyx))
  * [#90](https://github.com/holistics/dbml/pull/90) Support composite foreign keys ([@phanbaominh](https://github.com/phanbaominh))

#### Committers: 10
- Ben Young ([@Orclyx](https://github.com/Orclyx))
- David SPORN ([@sporniket](https://github.com/sporniket))
- Hamid ([@hamedsj](https://github.com/hamedsj))
- Júlio Zynger ([@julioz](https://github.com/julioz))
- Khanh Thuy Mai Nguyen ([@khanhtmn](https://github.com/khanhtmn))
- Matija Stepanic ([@stepanic](https://github.com/stepanic))
- Phan Bao Minh ([@phanbaominh](https://github.com/phanbaominh))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))
- Thinh Tran ([@duythinht](https://github.com/duythinht))
- [@Vanderhoof](https://github.com/Vanderhoof)

## v2.0.1 (2020-04-16)

#### :bug: Bug Fix
* `dbml-core`
  * [#83](https://github.com/holistics/dbml/pull/83) Parse index note for DBML ([@phuongduyphan](https://github.com/phuongduyphan))
  * [#80](https://github.com/holistics/dbml/pull/80) Schemarb/support single quote ([@khoahuynhf](https://github.com/khoahuynhf))

#### Committers: 2
- Khoa Huỳnh ([@khoahuynhf](https://github.com/khoahuynhf))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v2.0.0-alpha.0 (2020-02-27)

#### :boom: Breaking Change
* `dbml-core`
  * [#47](https://github.com/holistics/dbml/pull/47) Restructure and normalize models ([@phuongduyphan](https://github.com/phuongduyphan))

#### :rocket: New Feature
* `dbml-core`
  * [#47](https://github.com/holistics/dbml/pull/47) Add Project, Note and multi-line string syntax ([@phuongduyphan](https://github.com/phuongduyphan))

#### :memo: Documentation
* [#69](https://github.com/holistics/dbml/pull/69) Fix typo in readme ([@bmitchinson](https://github.com/bmitchinson))
* [#47](https://github.com/holistics/dbml/pull/47) Add Project, Note and multi-line string syntax ([@phuongduyphan](https://github.com/phuongduyphan))

#### :bug: Bug Fix
* [#69](https://github.com/holistics/dbml/pull/69) Fix typo in readme ([@bmitchinson](https://github.com/bmitchinson))

#### Committers: 2
- Ben Mitchinson ([@bmitchinson](https://github.com/bmitchinson))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v1.3.1 (2020-01-22)

#### :bug: Bug Fix
* `dbml-core`
  * [#65](https://github.com/holistics/dbml/pull/65) Fix parsing index comment ([@phuongduyphan](https://github.com/phuongduyphan))
  * [#64](https://github.com/holistics/dbml/pull/64) Parse array type for dbml ([@phuongduyphan](https://github.com/phuongduyphan))
  * [#57](https://github.com/holistics/dbml/pull/57) Fix DBML one-to-one relation exporting bug  ([@dawitkk](https://github.com/dawitkk))

#### Committers: 2
- Dawit Kidane ([@dawitkk](https://github.com/dawitkk))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v1.3.0 (2019-12-24)

#### :rocket: New Feature
* `dbml-core`
  * [#54](https://github.com/holistics/dbml/pull/54) Feature: Referential actions for ActiveRecord Rails ([@phuongduyphan](https://github.com/phuongduyphan))
  * [#29](https://github.com/holistics/dbml/pull/29) Feature: Referential actions ([@flemeur](https://github.com/flemeur))

#### :house_with_garden: Internal
* `dbml-core`
  * [#43](https://github.com/holistics/dbml/pull/43) Indent JSON generated by JsonExporter ([@ilyakharlamov](https://github.com/ilyakharlamov))

#### Committers: 3
- Flemming Andersen ([@flemeur](https://github.com/flemeur))
- Ilya Kharlamov ([@ilyakharlamov](https://github.com/ilyakharlamov))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v1.2.1 (2019-10-30)

#### :bug: Bug Fix
* `dbml-core`
  * [#41](https://github.com/holistics/dbml/pull/41) Remove defaut header color ([@phuongduyphan](https://github.com/phuongduyphan))

#### Committers: 1
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v1.2.0 (2019-10-24)

#### :rocket: New Feature
* `dbml-core`
  * [#39](https://github.com/holistics/dbml/pull/39) Support import/export comment syntax for dbml, mysql and postgres ([@phuongduyphan](https://github.com/phuongduyphan))
  * [#35](https://github.com/holistics/dbml/pull/35) Add composite primary key ([@duynvu](https://github.com/duynvu))

#### Committers: 2
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))
- Vũ Duy ([@duynvu](https://github.com/duynvu))

## v1.1.3 (2019-10-10)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#32](https://github.com/holistics/dbml/pull/32) Add SQL Server export ([@duynvu](https://github.com/duynvu))

#### Committers: 1
- Vũ Duy ([@duynvu](https://github.com/duynvu))

## v1.1.2 (2019-09-04)

#### :bug: Bug Fix
* `dbml-core`
  * [#27](https://github.com/holistics/dbml/pull/27) Fix relationship description ([@duynvu](https://github.com/duynvu))

#### :rocket: New Feature
* `dbml-core`
  * [#28](https://github.com/holistics/dbml/pull/28) Add supporting TableGroup syntax ([@phuongduyphan](https://github.com/phuongduyphan))

#### Committers: 3
- Khoa Huỳnh ([@khoahuynhf](https://github.com/khoahuynhf))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))
- Vũ Duy ([@duynvu](https://github.com/duynvu))

## v1.1.1 (2019-09-03)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#26](https://github.com/holistics/dbml/pull/26) Output Syntax Error location to console ([@phuongduyphan](https://github.com/phuongduyphan))

#### Committers: 1
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v1.1.0 (2019-09-02)

#### :memo: Documentation
* `dbml-homepage`
  * [#23](https://github.com/holistics/dbml/pull/23) dbml homepage/change docs ([@phuongduyphan](https://github.com/phuongduyphan))
  * [#19](https://github.com/holistics/dbml/pull/19) docs: add cli and tooling docs ([@phuongduyphan](https://github.com/phuongduyphan))

#### :boom: Breaking Change
* `dbml-cli`
  * [#24](https://github.com/holistics/dbml/pull/24) Change CLI interface ([@phuongduyphan](https://github.com/phuongduyphan))

#### :house_with_garden: Internal
* `dbml-homepage`
  * [#21](https://github.com/holistics/dbml/pull/21) chore: move dbml-homepage outside, add readme ([@phuongduyphan](https://github.com/phuongduyphan))

#### Committers: 1
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))

## v1.0.0 (2019-08-19)

#### :boom: Breaking Change
* `dbml-cli`
  * [#16](https://github.com/holistics/dbml/pull/16) Add @dbml/cli package ([@phuongduyphan](https://github.com/phuongduyphan))
* `dbml-core`
  * [#15](https://github.com/holistics/dbml/pull/15) Add @dbml/core package ([@phuongduyphan](https://github.com/phuongduyphan))

#### :house_with_garden: Internal
* `dbml-homepage`
  * [#18](https://github.com/holistics/dbml/pull/18) docs: add @dbml/homepage package ([@phuongduyphan](https://github.com/phuongduyphan))

#### Committers: 2
- Khoa Huỳnh ([@khoa0319](https://github.com/khoa0319))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))
