## v5.3.1 (2025-12-23)

#### :robot: Dependencies Update
* `dbml-connector`
  * [#792](https://github.com/holistics/dbml/pull/792) deps(connector): bump snowflake-sdk to 2.3.3 ([@nguyenalter](https://github.com/nguyenalter))
* Other
  * [#790](https://github.com/holistics/dbml/pull/790) chore(deps)/bump node-glob to v10.5.0 ([@H-DNA](https://github.com/H-DNA))

#### Committers: 2
- Huy DNA ([@H-DNA](https://github.com/H-DNA))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v5.3.0 (2025-12-04)

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`
  * [#785](https://github.com/holistics/dbml/pull/785) Oracle connector ([@H-DNA](https://github.com/H-DNA))

#### Committers: 1
- Huy DNA ([@H-DNA](https://github.com/H-DNA))

## v5.2.0 (2025-11-19)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#774](https://github.com/holistics/dbml/pull/774) db2dbml not marking primary key composite indexes with pk ([@H-DNA](https://github.com/H-DNA))
  * [#774](https://github.com/holistics/dbml/pull/774) @dbml/connector's fetchSchemaJson now respects the Field type definition defined in @dbml/connector and @dbml/core's generateDatabase now expects `pk` key instead of `primary` in Field object ([@H-DNA](https://github.com/H-DNA))
* `dbml-core`
  * [#654](https://github.com/holistics/dbml/pull/654) fix(dbml/core): avoid dangling 'default: ' in DbmlExporter when field.dbdefault.type is invalid ([@Mrxyy](https://github.com/Mrxyy))

#### :rocket: New Feature
* `dbml-core`
  * [#778](https://github.com/holistics/dbml/pull/778) Support dynamic delimiter in mysql parser ([@H-DNA](https://github.com/H-DNA))
* `dbml-cli`, `dbml-core`
  * [#775](https://github.com/holistics/dbml/pull/775) Support OracleSQL importer ([@H-DNA](https://github.com/H-DNA))
* `dbml-parse`
  * [#777](https://github.com/holistics/dbml/pull/777) Feat/support enum as default value ([@H-DNA](https://github.com/H-DNA))

#### :house_with_garden: Internal
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#776](https://github.com/holistics/dbml/pull/776) Setup lint ([@H-DNA](https://github.com/H-DNA))

#### Committers: 2
- Huy DNA ([@H-DNA](https://github.com/H-DNA))
- Mrxyy ([@Mrxyy](https://github.com/Mrxyy))

## v5.1.0 (2025-10-28)

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`
  * [#766](https://github.com/holistics/dbml/pull/766) Support check constraints in @dbml/connector ([@H-DNA](https://github.com/H-DNA))

#### Committers: 1
- DNA ([@H-DNA](https://github.com/H-DNA))

## v5.0.0 (2025-10-28)

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#770](https://github.com/holistics/dbml/pull/770) Breaking change: Change `constraint` keyword to `check` ([@H-DNA](https://github.com/H-DNA))

#### Committers: 1
- DNA ([@H-DNA](https://github.com/H-DNA))

## v4.0.0 (2025-10-23)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#765](https://github.com/holistics/dbml/pull/765) feat: Support check constraint ([@H-DNA](https://github.com/H-DNA))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#765](https://github.com/holistics/dbml/pull/765) fix!: Remove `CONSTRAINT` from `pl_unreserved_keywords` in PostgreSQL ANTLR syntax ([@H-DNA](https://github.com/H-DNA))

#### Committers: 1
- DNA ([@H-DNA](https://github.com/H-DNA))

## v3.14.1 (2025-09-22)

#### :bug: Bug Fix
* `dbml-core`
  * [#759](https://github.com/holistics/dbml/pull/759) fix: export dbml to oracle - export default value before inline constraint ([@huyleminh01](https://github.com/huyleminh01))

#### :robot: Dependencies Update
* [#753](https://github.com/holistics/dbml/pull/753) chore(deps-dev): bump vite from 6.3.5 to 6.3.6 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 1
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))

## v3.14.0 (2025-09-16)

#### :memo: Documentation
* `dbml-cli`
  * [#758](https://github.com/holistics/dbml/pull/758) misc: update bigquery connector cli description on homepage ([@huyleminh01](https://github.com/huyleminh01))
* Other
  * [#746](https://github.com/holistics/dbml/pull/746) DBX-6222 Remove docs, use dbx-rfc instead ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-parse`
  * [#741](https://github.com/holistics/dbml/pull/741) Add dbml playground and basic RFCs ([@huyphung1602](https://github.com/huyphung1602))

#### :bug: Bug Fix
* [#745](https://github.com/holistics/dbml/pull/745) DBX-6210 misc: bump form-data v4 to 4.0.4 and v2 to 2.5.5 to fix security issues ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`
  * [#755](https://github.com/holistics/dbml/pull/755) BigQuery ADC (Application Default Credentials) support ([@StephaneBischoffVasco](https://github.com/StephaneBischoffVasco))

#### :robot: Dependencies Update
* [#747](https://github.com/holistics/dbml/pull/747) DBX-6287: chore(deps): bump @eslint/plugin-kit from 0.3.3 to 0.3.4 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 5
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Stephane Bischoff ([@StephaneBischoffVasco](https://github.com/StephaneBischoffVasco))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.13.9 (2025-07-22)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#743](https://github.com/holistics/dbml/pull/743) fix: remove `lodash-es` from external config and update lodash import to have better tree shaking ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 1
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v3.13.8 (2025-07-22)

#### :robot: Dependencies Update
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#739](https://github.com/holistics/dbml/pull/739) perf(dbml-parse): Migrate lodash to lodash-es to reduce bundle size and fix indirect import issue ([@xuantho573](https://github.com/xuantho573))

#### Committers: 1
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.13.7 (2025-07-16)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#738](https://github.com/holistics/dbml/pull/738) Fix builtin data types with uppercase characters are double-quoted when export DBML to Postgres ([@xuantho573](https://github.com/xuantho573))

#### :robot: Dependencies Update
* [#737](https://github.com/holistics/dbml/pull/737) DBX-6165 - chore(deps): bump brace-expansion from 1.1.11 to 1.1.12 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.13.6 (2025-06-19)

#### :memo: Documentation
* [#732](https://github.com/holistics/dbml/pull/732) Docs: Add Scafoldr to Community Contributions ([@DimitrijeGlibic](https://github.com/DimitrijeGlibic))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`
  * [#735](https://github.com/holistics/dbml/pull/735) DBX-4495 Surround column type with quotes when export if it contain uppercase character ([@NQPhuc](https://github.com/NQPhuc))

#### :robot: Dependencies Update
* [#733](https://github.com/holistics/dbml/pull/733) DBX-6028 Bump express and prismjs to fix vulnerability issues ([@nguyenalter](https://github.com/nguyenalter))
* [#721](https://github.com/holistics/dbml/pull/721) chore(deps): bump snowflake-sdk from 2.0.3 to 2.0.4 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 4
- Dimitrije Glibic ([@DimitrijeGlibic](https://github.com/DimitrijeGlibic))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.13.5 (2025-05-08)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#598](https://github.com/holistics/dbml/pull/598) Fix/unwrap none in convert funcAppToElem ([@Huy-DNA](https://github.com/Huy-DNA))
* `dbml-parse`
  * [#717](https://github.com/holistics/dbml/pull/717) Fix missing suggestion for ref color ([@xuantho573](https://github.com/xuantho573))

#### Committers: 2
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.13.4 (2025-05-06)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#728](https://github.com/holistics/dbml/pull/728) Feat: allow unlimited prefix expression in column type with argument and default value ([@NQPhuc](https://github.com/NQPhuc))
  * [#720](https://github.com/holistics/dbml/pull/720) Fix not handling column type with arguments in TablePartial ([@xuantho573](https://github.com/xuantho573))
* `dbml-core`, `dbml-parse`
  * [#727](https://github.com/holistics/dbml/pull/727) Fix table must define column when have partials with columns ([@xuantho573](https://github.com/xuantho573))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#728](https://github.com/holistics/dbml/pull/728) Feat: allow unlimited prefix expression in column type with argument and default value ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))

## v3.13.2 (2025-05-05)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#657](https://github.com/holistics/dbml/pull/657) PR: Bug Closes [#655](https://github.com/holistics/dbml/issues/655) - DB2DBML - SQL Server - No description on Table ([@MisterGeek](https://github.com/MisterGeek))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- [@MisterGeek](https://github.com/MisterGeek)

## v3.13.1 (2025-04-28)

#### :bug: Bug Fix
* `dbml-core`
  * [#718](https://github.com/holistics/dbml/pull/718) MSSQL: fix cannot parse varchar(max) and double precision ([@huyleminh01](https://github.com/huyleminh01))

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
  * [#709](https://github.com/holistics/dbml/pull/709) ft: support table partial ([@NQPhuc](https://github.com/NQPhuc))

#### :bug: Bug Fix
* `dbml-connector`
  * [#714](https://github.com/holistics/dbml/pull/714) Fix flaky db2dbml/mssql test cause by inconsistent table ordering ([@NQPhuc](https://github.com/NQPhuc))
* `dbml-core`
  * [#713](https://github.com/holistics/dbml/pull/713) fix(antlr.pg): filter null table when importing postgresql ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#709](https://github.com/holistics/dbml/pull/709) ft: support table partial ([@NQPhuc](https://github.com/NQPhuc))

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
  * [#690](https://github.com/holistics/dbml/pull/690) Support parse insert from SQL DDL and new parser for MSSQL ([@huyleminh01](https://github.com/huyleminh01))
* Other
  * [#702](https://github.com/holistics/dbml/pull/702) Update README.md ([@nielsbosma](https://github.com/nielsbosma))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`, `dbml-core`, `dbml-parse`
  * [#690](https://github.com/holistics/dbml/pull/690) Support parse insert from SQL DDL and new parser for MSSQL ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Niels Bosma ([@nielsbosma](https://github.com/nielsbosma))

## v3.11.0 (2025-04-01)

#### :memo: Documentation
* [#689](https://github.com/holistics/dbml/pull/689) Doc: fix wrong double quote character ([@nguyenalter](https://github.com/nguyenalter))
* [#471](https://github.com/holistics/dbml/pull/471) docs: add treesitter parser ([@dynamotn](https://github.com/dynamotn))

#### :rocket: New Feature
* `dbml-cli`, `dbml-connector`
  * [#692](https://github.com/holistics/dbml/pull/692) [DBX-5925] Add key pair authentication for Snowflake connector ([@xuantho573](https://github.com/xuantho573))

#### :robot: Dependencies Update
* `dbml-cli`, `dbml-connector`
  * [#692](https://github.com/holistics/dbml/pull/692) [DBX-5925] Add key pair authentication for Snowflake connector ([@xuantho573](https://github.com/xuantho573))

#### Committers: 4
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Tho Nguyen Xuan ([@xuantho573](https://github.com/xuantho573))
- Trần Đức Nam ([@dynamotn](https://github.com/dynamotn))

## v3.10.2 (2025-03-03)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#670](https://github.com/holistics/dbml/pull/670) Fix duplicated enums refs mssql connector ([@huyphung1602](https://github.com/huyphung1602))

#### :robot: Dependencies Update
* [#673](https://github.com/holistics/dbml/pull/673) Bump vite from 4.5.5 to 4.5.6 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.10.1 (2025-02-28)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#683](https://github.com/holistics/dbml/pull/683) fix: Incorrect Ref color settings position ([@NQPhuc](https://github.com/NQPhuc))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#678](https://github.com/holistics/dbml/pull/678) ft: support color and name for short & long forms of the relationship ([@NQPhuc](https://github.com/NQPhuc))

#### Committers: 1
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.9.6 (2025-02-20)

#### :bug: Bug Fix
* `dbml-parse`
  * [#677](https://github.com/holistics/dbml/pull/677) DBX-5750: Fix an issue where tab characters are not recognized as white-space characters ([@xuantho573](https://github.com/xuantho573))
* `dbml-core`, `dbml-parse`
  * [#679](https://github.com/holistics/dbml/pull/679) Fix: Unset not_null if null or not_null setting is not specified ([@nguyenalter](https://github.com/nguyenalter))
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
  * [#660](https://github.com/holistics/dbml/pull/660) fix: db2dbml bigquery connector's query ([@kenzht](https://github.com/kenzht))

#### :robot: Dependencies Update
* [#661](https://github.com/holistics/dbml/pull/661) Bump cross-spawn from 7.0.3 to 7.0.6 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- [@kenzht](https://github.com/kenzht)

## v3.9.3 (2024-10-30)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#650](https://github.com/holistics/dbml/pull/650) Connector - Keep table ordinal position ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.9.2 (2024-10-15)

#### :bug: Bug Fix
* `dbml-core`
  * [#647](https://github.com/holistics/dbml/pull/647) Fix model-exporter don't export sticky notes, table group notes and color ([@thonx-holistics](https://github.com/thonx-holistics))

#### Committers: 1
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))

## v3.9.1 (2024-10-14)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#645](https://github.com/holistics/dbml/pull/645) Fix mssql connector - Missing data type size for numeric-based and string-based columns ([@huyleminh01](https://github.com/huyleminh01))
* `dbml-core`
  * [#646](https://github.com/holistics/dbml/pull/646) Model Exporter cannot export <> refs in dbml ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.9.0 (2024-09-13)

#### :bug: Bug Fix
* `dbml-parse`
  * [#632](https://github.com/holistics/dbml/pull/632) chore/upgrade vite plugin dts & fix tsconfig to properly include all sources ([@Huy-DNA](https://github.com/Huy-DNA))

#### :boom: Breaking Change
* `dbml-core`, `dbml-parse`
  * [#594](https://github.com/holistics/dbml/pull/594) Parse/fix!/no longer support escaping triple quote ([@Huy-DNA](https://github.com/Huy-DNA))

#### :robot: Dependencies Update
* Other
  * [#625](https://github.com/holistics/dbml/pull/625) Bump micromatch from 4.0.5 to 4.0.8 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#628](https://github.com/holistics/dbml/pull/628) Bump webpack from 5.91.0 to 5.94.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
  * [#637](https://github.com/holistics/dbml/pull/637) Bump express from 4.19.2 to 4.21.0 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* `dbml-parse`
  * [#632](https://github.com/holistics/dbml/pull/632) chore/upgrade vite plugin dts & fix tsconfig to properly include all sources ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.8.1 (2024-09-11)

#### :memo: Documentation
* [#627](https://github.com/holistics/dbml/pull/627) Docs - Update doc for bigquery and snowflake connector ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-cli`, `dbml-connector`
  * [#634](https://github.com/holistics/dbml/pull/634) Fix postgres connector issues ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-core`
  * [#629](https://github.com/holistics/dbml/pull/629) Fix: When the parameter format is JSON in Parser.parse, the first parameter 'parse' must be RawDatabase ([@Mrxyy](https://github.com/Mrxyy))

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
  * [#606](https://github.com/holistics/dbml/pull/606) Parse/fix/wrongly extract index position ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 4
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Thi Nguyen ([@TeaNguyen](https://github.com/TeaNguyen))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

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
  * [#609](https://github.com/holistics/dbml/pull/609) Fix - Clean build cache and required using node 18 or higher ([@huyleminh01](https://github.com/huyleminh01))

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
  * [#592](https://github.com/holistics/dbml/pull/592) chore: config vite to gen .d.ts file on build ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Tho Nguyen ([@thonx-holistics](https://github.com/thonx-holistics))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.6.1 (2024-07-23)

#### :bug: Bug Fix
* `dbml-parse`
  * [#588](https://github.com/holistics/dbml/pull/588) fix: safe unwrapping in suggesting attribute value when name is blank ([@Huy-DNA](https://github.com/Huy-DNA))

#### :robot: Dependencies Update
* [#583](https://github.com/holistics/dbml/pull/583) build(deps): bump ws from 7.5.9 to 7.5.10 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

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
  * [#579](https://github.com/holistics/dbml/pull/579) Fix/silent errors in compiler api stack container ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.5.0 (2024-06-04)

#### :memo: Documentation
* [#571](https://github.com/holistics/dbml/pull/571) Migrate - Remove old hompepage and rename docs folder to homepage ([@huyleminh01](https://github.com/huyleminh01))
* [#570](https://github.com/holistics/dbml/pull/570) Fix - Rename file syntax to docs to keep old route ([@huyleminh01](https://github.com/huyleminh01))
* [#568](https://github.com/holistics/dbml/pull/568) Docs - Migrate dbml homepage to docusaurus ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-parse`
  * [#575](https://github.com/holistics/dbml/pull/575) Fix/remove tablegroup in schema ([@Huy-DNA](https://github.com/Huy-DNA))

#### :rocket: New Feature
* `dbml-core`
  * [#574](https://github.com/holistics/dbml/pull/574) Export @dbml/core version ([@nguyenalter](https://github.com/nguyenalter))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.4.3 (2024-04-26)

#### :bug: Bug Fix
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#563](https://github.com/holistics/dbml/pull/563) Properly indent indexes in table ([@pierresouchay](https://github.com/pierresouchay))
* `dbml-core`, `dbml-parse`
  * [#564](https://github.com/holistics/dbml/pull/564) Fix/add token to index column ([@Huy-DNA](https://github.com/Huy-DNA))

#### :robot: Dependencies Update
* `dbml-parse`
  * [#554](https://github.com/holistics/dbml/pull/554) build(deps): bump ip from 2.0.0 to 2.0.1 ([@dependabot[bot]](https://github.com/apps/dependabot))
* Other
  * [#557](https://github.com/holistics/dbml/pull/557) build(deps): bump axios from 1.3.4 to 1.6.8 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 3
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.4.2 (2024-04-25)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#561](https://github.com/holistics/dbml/pull/561) parse/fix/throw undefined at primary expression ([@Huy-DNA](https://github.com/Huy-DNA))
* `dbml-cli`, `dbml-core`
  * [#549](https://github.com/holistics/dbml/pull/549) fix(postgresql): properly handle definition of unique and PK constraints in ALTER TABLE statements ([@pierresouchay](https://github.com/pierresouchay))

#### :robot: Dependencies Update
* [#552](https://github.com/holistics/dbml/pull/552) build(deps-dev): bump vite from 4.5.0 to 4.5.3 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 3
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.4.1 (2024-04-16)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#543](https://github.com/holistics/dbml/pull/543) parse/trim note top empty lines ([@Huy-DNA](https://github.com/Huy-DNA))

#### :rocket: New Feature
* `dbml-core`, `dbml-parse`
  * [#547](https://github.com/holistics/dbml/pull/547) Add project's token into interpreter result ([@huyphung1602](https://github.com/huyphung1602))
* `dbml-parse`
  * [#535](https://github.com/holistics/dbml/pull/535) Support continuation mark and catch invalid escape sequence ([@Huy-DNA](https://github.com/Huy-DNA))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`
  * [#541](https://github.com/holistics/dbml/pull/541) fix: define a common error format ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 3
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.4.0 (2024-03-19)

#### :bug: Bug Fix
* `dbml-parse`
  * [#539](https://github.com/holistics/dbml/pull/539) fix: normalize note content in projects ([@Huy-DNA](https://github.com/Huy-DNA))

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`
  * [#534](https://github.com/holistics/dbml/pull/534) New feature: Export DBML to Oracle version 19c ([@huyleminh01](https://github.com/huyleminh01))

#### Committers: 3
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.3.0 (2024-03-19)

#### :memo: Documentation
* [#533](https://github.com/holistics/dbml/pull/533) Add Sticky Notes syntax guide and a new community contribution ([@huyphung1602](https://github.com/huyphung1602))
* [#529](https://github.com/holistics/dbml/pull/529) Add contributor dbml java ([@huyleminh01](https://github.com/huyleminh01))

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#536](https://github.com/holistics/dbml/pull/536) fix: add normalize note content ([@Huy-DNA](https://github.com/Huy-DNA))
* `dbml-parse`
  * [#526](https://github.com/holistics/dbml/pull/526) Parser/fix `getRefId` ([@Huy-DNA](https://github.com/Huy-DNA))

#### :rocket: New Feature
* `dbml-parse`
  * [#521](https://github.com/holistics/dbml/pull/521) Parser/support non ascii letters in identifiers ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 4
- Huy Le Minh ([@huyleminh01](https://github.com/huyleminh01))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- harryphung ([@huyphung1602](https://github.com/huyphung1602))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.2.0 (2024-02-26)

#### :rocket: New Feature
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#500](https://github.com/holistics/dbml/pull/500) Support sticky note syntaxes ([@huyphung1602](https://github.com/huyphung1602))

#### Committers: 1
- harryphung ([@huyphung1602](https://github.com/huyphung1602))

## v3.1.8 (2024-02-21)

#### :bug: Bug Fix
* `dbml-parse`
  * [#524](https://github.com/holistics/dbml/pull/524) fix: unquoted update & delete ref setting ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.1.7 (2024-02-20)

#### :bug: Bug Fix
* `dbml-parse`
  * [#522](https://github.com/holistics/dbml/pull/522) Parser/interpret ref on update ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.1.6 (2024-02-20)

#### :memo: Documentation
* [#512](https://github.com/holistics/dbml/pull/512) Add contribution for DB2Code ([@NQPhuc](https://github.com/NQPhuc))

#### :bug: Bug Fix
* `dbml-parse`
  * [#519](https://github.com/holistics/dbml/pull/519) Remove ref in table syntax ([@Huy-DNA](https://github.com/Huy-DNA))
  * [#518](https://github.com/holistics/dbml/pull/518) Add check for table reappear in tablegroups ([@Huy-DNA](https://github.com/Huy-DNA))
  * [#515](https://github.com/holistics/dbml/pull/515) Fix validate when redundant args & `getMemberChain` ([@Huy-DNA](https://github.com/Huy-DNA))
  * [#517](https://github.com/holistics/dbml/pull/517) Fix circular ref ([@Huy-DNA](https://github.com/Huy-DNA))
* `dbml-core`
  * [#503](https://github.com/holistics/dbml/pull/503) fix(notes): properly escape notes with new lines ([@pierresouchay](https://github.com/pierresouchay))

#### :boom: Breaking Change
* `dbml-parse`
  * [#519](https://github.com/holistics/dbml/pull/519) Remove ref in table syntax ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 3
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- Đỗ Nguyễn An Huy ([@Huy-DNA](https://github.com/Huy-DNA))

## v3.1.5 (2024-02-06)

#### :bug: Bug Fix
* `dbml-parse`
  * [#510](https://github.com/holistics/dbml/pull/510) fix: support identifiers starting with numbers ([@Huy-DNA](https://github.com/Huy-DNA))
  * [#509](https://github.com/holistics/dbml/pull/509) fix: type errors and missing return ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- HuyDNA ([@Huy-DNA](https://github.com/Huy-DNA))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.1.4 (2024-02-05)

#### :bug: Bug Fix
* `dbml-core`, `dbml-parse`
  * [#507](https://github.com/holistics/dbml/pull/507) fix: swap ref endpoints in inline_refs ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- HuyDNA ([@Huy-DNA](https://github.com/Huy-DNA))
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))

## v3.1.3 (2024-02-01)

#### :bug: Bug Fix
* `dbml-parse`
  * [#504](https://github.com/holistics/dbml/pull/504) Fix/dbml alias & primary key & note content bug ([@Huy-DNA](https://github.com/Huy-DNA))

#### Committers: 2
- HuyDNA ([@Huy-DNA](https://github.com/Huy-DNA))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))

## v3.1.2 (2024-01-24)

#### :memo: Documentation
* `dbml-parse`
  * [#498](https://github.com/holistics/dbml/pull/498) feat: support strings and identifiers in column caller type ([@huy-dna](https://github.com/huy-dna))

#### :bug: Bug Fix
* `dbml-core`
  * [#493](https://github.com/holistics/dbml/pull/493) fix(sql2dbml): properly escape notes when notes do contain some ' ([@pierresouchay](https://github.com/pierresouchay))
* `dbml-parse`
  * [#498](https://github.com/holistics/dbml/pull/498) feat: support strings and identifiers in column caller type ([@huy-dna](https://github.com/huy-dna))

#### Committers: 3
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Pierre Souchay ([@pierresouchay](https://github.com/pierresouchay))
- [@huy-dna](https://github.com/huy-dna)

## v3.1.1 (2024-01-18)
* Fix wrong casing file names in published package

## v3.1.0 (2024-01-18)

#### :memo: Documentation
* [#479](https://github.com/holistics/dbml/pull/479) Update README ([@matthewjumpsoffbuildings](https://github.com/matthewjumpsoffbuildings))

#### :bug: Bug Fix
* `dbml-core`
  * [#487](https://github.com/holistics/dbml/pull/487) fix: type of note field that is string doesn show ([@Mrxyy](https://github.com/Mrxyy))
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
  * [#458](https://github.com/holistics/dbml/pull/458) Alternative dbml parser ([@huy-dna](https://github.com/huy-dna))

#### :boom: Breaking Change
* `dbml-cli`, `dbml-core`, `dbml-parse`
  * [#458](https://github.com/holistics/dbml/pull/458) Alternative dbml parser ([@huy-dna](https://github.com/huy-dna))

#### :robot: Dependencies Update
* [#469](https://github.com/holistics/dbml/pull/469) Bump browserify-sign from 4.0.4 to 4.2.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#451](https://github.com/holistics/dbml/pull/451) Bump fsevents from 1.2.9 to 1.2.13 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#464](https://github.com/holistics/dbml/pull/464) Bump @babel/traverse from 7.21.4 to 7.23.2 in /dbml-homepage ([@dependabot[bot]](https://github.com/apps/dependabot))
* [#463](https://github.com/holistics/dbml/pull/463) Bump @babel/traverse from 7.21.4 to 7.23.2 ([@dependabot[bot]](https://github.com/apps/dependabot))

#### Committers: 4
- NQPhuc ([@NQPhuc](https://github.com/NQPhuc))
- Nguyen Hoang ([@nguyenalter](https://github.com/nguyenalter))
- Vinh Ho ([@vinh-hh](https://github.com/vinh-hh))
- [@huy-dna](https://github.com/huy-dna)

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
  * [#16](https://github.com/holistics/dbml/pull/16) feat: add @dbml/cli package ([@phuongduyphan](https://github.com/phuongduyphan))
* `dbml-core`
  * [#15](https://github.com/holistics/dbml/pull/15) feat: add @dbml/core package ([@phuongduyphan](https://github.com/phuongduyphan))

#### :house_with_garden: Internal
* `dbml-homepage`
  * [#18](https://github.com/holistics/dbml/pull/18) docs: add @dbml/homepage package ([@phuongduyphan](https://github.com/phuongduyphan))

#### Committers: 2
- Khoa Huỳnh ([@khoa0319](https://github.com/khoa0319))
- Phuong Duy Phan ([@phuongduyphan](https://github.com/phuongduyphan))
