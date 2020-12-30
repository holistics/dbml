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