/**
 * Data behind the /ecosystem page.
 *
 * To add a project, append an entry to `communityProjects` and open a PR.
 * Keep `language` accurate — it is shown as-is on the card.
 */

export type CommunityCategory = 'parser' | 'editor' | 'to-dbml' | 'from-dbml';

export const communityCategoryLabels: Record<CommunityCategory, string> = {
  parser: 'Parsers & libraries',
  editor: 'Editors & IDEs',
  'to-dbml': 'Generate DBML',
  'from-dbml': 'Build from DBML',
};

export interface EcosystemItem {
  name: string;
  description: string;
  href: string;
  /** GitHub "owner/repo", when the project is hosted on GitHub. */
  repo?: string;
  /** Primary implementation language. */
  language?: string;
  /** Person or org behind the project, for community entries. */
  author?: string;
  categories?: CommunityCategory[];
}

export const officialApps: EcosystemItem[] = [
  {
    name: 'dbdiagram',
    description:
      'Draw and share entity-relationship diagrams straight from DBML code. Free, no install required.',
    href: 'https://dbdiagram.io/?utm_source=dbml&utm_medium=ecosystem',
  },
  {
    name: 'dbdocs',
    description:
      'Publish searchable, always-up-to-date database documentation from a DBML file.',
    href: 'https://dbdocs.io/?utm_source=dbml&utm_medium=ecosystem',
  },
  {
    name: 'RunSQL',
    description:
      'Spin up a throwaway database from your schema and validate SQL queries against it in the browser.',
    href: 'https://runsql.com/?utm_source=dbml&utm_medium=ecosystem',
  },
  {
    name: 'Holistics',
    description:
      'The analytics platform behind DBML — BI modelling and reporting defined as code.',
    href: 'https://www.holistics.io/?utm_source=dbml&utm_medium=ecosystem',
  },
];

export const officialPackages: EcosystemItem[] = [
  {
    name: '@dbml/core',
    description:
      'Parse DBML, convert SQL DDL to DBML, and export DBML back to SQL — in Node or the browser.',
    href: '/js-module/core',
    repo: 'holistics/dbml',
    language: 'TypeScript',
  },
  {
    name: '@dbml/cli',
    description:
      'Command-line tool to convert between DBML and SQL DDL files, and to pull schemas from a live database.',
    href: '/cli',
    repo: 'holistics/dbml',
    language: 'TypeScript',
  },
  {
    name: '@dbml/connector',
    description:
      'Connect to PostgreSQL, MySQL, MSSQL, Oracle, Snowflake or BigQuery and extract the schema as JSON.',
    href: '/js-module/connector',
    repo: 'holistics/dbml',
    language: 'TypeScript',
  },
];

export const communityProjects: EcosystemItem[] = [
  {
    name: 'PyDBML',
    description: 'DBML parser and builder for Python.',
    href: 'https://github.com/Vanderhoof/PyDBML',
    repo: 'Vanderhoof/PyDBML',
    language: 'Python',
    author: 'Vanderhoof',
    categories: ['parser'],
  },
  {
    name: 'dbml-go',
    description: 'DBML parser and tools for Go.',
    href: 'https://github.com/duythinht/dbml-go',
    repo: 'duythinht/dbml-go',
    language: 'Go',
    author: 'duythinht',
    categories: ['parser'],
  },
  {
    name: 'dbml-java',
    description: 'DBML parser for the JVM, written for Java 17.',
    href: 'https://github.com/nilswende/dbml-java',
    repo: 'nilswende/dbml-java',
    language: 'Java',
    author: 'Nils Wende',
    categories: ['parser'],
  },
  {
    name: 'dbml-parser',
    description: "DBML parser for PHP 8.",
    href: 'https://github.com/butschster/dbml-parser',
    repo: 'butschster/dbml-parser',
    language: 'PHP',
    author: 'Butschster',
    categories: ['parser'],
  },
  {
    name: 'Ivy.Dbml.Parser',
    description: 'DBML parser for .NET.',
    href: 'https://github.com/Ivy-Interactive/Ivy.Dbml.Parser',
    repo: 'Ivy-Interactive/Ivy.Dbml.Parser',
    language: 'C#',
    author: 'Niels Bosma',
    categories: ['parser'],
  },
  {
    name: 'Elixir DBML',
    description:
      'Elixir parser for DBML, plus generators for Ecto schemas and migrations.',
    href: 'https://github.com/saleyn/dbml',
    repo: 'saleyn/dbml',
    language: 'Elixir',
    author: 'saleyn',
    categories: ['parser', 'from-dbml'],
  },
  {
    name: 'tree-sitter-dbml',
    description:
      'DBML grammar for tree-sitter — syntax highlighting and structural editing for any editor built on it.',
    href: 'https://github.com/dynamotn/tree-sitter-dbml',
    repo: 'dynamotn/tree-sitter-dbml',
    language: 'C',
    author: 'dynamotn',
    categories: ['parser', 'editor'],
  },
  {
    name: 'DBML for VSCode',
    description: 'Syntax highlighting and language support for DBML in Visual Studio Code.',
    href: 'https://marketplace.visualstudio.com/items?itemName=duynvu.dbml-language',
    author: 'duynvu',
    categories: ['editor'],
  },
  {
    name: 'DBML for JetBrains IDEs',
    description:
      'DBML support for IntelliJ IDEA, PyCharm, DataGrip and the rest of the JetBrains family.',
    href: 'https://plugins.jetbrains.com/plugin/30905-dbml',
    author: 'LiamClarkeNZ',
    categories: ['editor'],
  },
  {
    name: 'vim-dbml',
    description: 'Syntax highlighting and filetype detection for DBML in Vim.',
    href: 'https://github.com/jidn/vim-dbml',
    repo: 'jidn/vim-dbml',
    language: 'Vim Script',
    author: 'jidn',
    categories: ['editor'],
  },
  {
    name: 'dbd-mode',
    description: 'Emacs major mode for editing DBML files.',
    href: 'https://github.com/ccod/dbd-mode',
    repo: 'ccod/dbd-mode',
    language: 'Emacs Lisp',
    author: 'ccod',
    categories: ['editor'],
  },
  {
    name: 'prisma-dbml-generator',
    description: 'Generate a DBML schema from your Prisma schema.',
    href: 'https://github.com/notiz-dev/prisma-dbml-generator',
    repo: 'notiz-dev/prisma-dbml-generator',
    language: 'TypeScript',
    author: 'Marc Stammerjohann',
    categories: ['to-dbml'],
  },
  {
    name: 'schema_to_dbml',
    description: "Ruby gem that generates DBML from a Rails schema.rb file.",
    href: 'https://github.com/ricardojcribeiro/schema_to_dbml',
    repo: 'ricardojcribeiro/schema_to_dbml',
    language: 'Ruby',
    author: 'Ricardo Ribeiro',
    categories: ['to-dbml'],
  },
  {
    name: 'Kacher',
    description: 'Convert Laravel (Doctrine) database schemas to DBML.',
    href: 'https://github.com/aphisitworachorch/kacher',
    repo: 'aphisitworachorch/kacher',
    language: 'PHP',
    author: 'Arsanandha Aphisitworachorch',
    categories: ['to-dbml'],
  },
  {
    name: 'DbmlForDjango',
    description: 'Converter between Django models.py and DBML, in both directions.',
    href: 'https://github.com/hamedsj/DbmlForDjango',
    repo: 'hamedsj/DbmlForDjango',
    language: 'Python',
    author: 'hamedsj',
    categories: ['to-dbml', 'from-dbml'],
  },
  {
    name: 'FloorPlan',
    description: "Render Android Room database schemas as ER diagrams via DBML.",
    href: 'https://github.com/julioz/FloorPlan',
    repo: 'julioz/FloorPlan',
    language: 'Kotlin',
    author: 'julioz',
    categories: ['to-dbml'],
  },
  {
    name: 'snowflake-dbml-generator',
    description:
      'Generate DBML from a Snowflake database, with configurable primary keys and relationship inference.',
    href: 'https://github.com/ryanrozich/snowflake-dbml-generator',
    repo: 'ryanrozich/snowflake-dbml-generator',
    language: 'Python',
    author: 'Ryan Rozich',
    categories: ['to-dbml'],
  },
  {
    name: 'd365fo-entity-schema',
    description:
      'Visual Studio extension that generates DBML entity schemas from Dynamics 365 Finance & Operations.',
    href: 'https://github.com/noakesey/d365fo-entity-schema',
    repo: 'noakesey/d365fo-entity-schema',
    language: 'C#',
    author: 'noakesey',
    categories: ['to-dbml'],
  },
  {
    name: 'DB2Code',
    description: 'Generate DBML (and other files) from JDBC metadata, via Maven.',
    href: 'https://github.com/alberlau/DB2Code',
    repo: 'alberlau/DB2Code',
    language: 'Java',
    author: 'alberlau',
    categories: ['to-dbml'],
  },
  {
    name: 'parse-server-SCHEMA-to-DBML',
    description:
      'Convert a Parse Server MongoDB _SCHEMA collection into DBML to visualise relations between Parse classes.',
    href: 'https://github.com/stepanic/parse-server-SCHEMA-to-DBML',
    repo: 'stepanic/parse-server-SCHEMA-to-DBML',
    language: 'JavaScript',
    author: 'stepanic',
    categories: ['to-dbml'],
  },
  {
    name: 'dbml-renderer',
    description: 'CLI that renders a DBML file to an SVG diagram.',
    href: 'https://github.com/softwaretechnik-berlin/dbml-renderer',
    repo: 'softwaretechnik-berlin/dbml-renderer',
    language: 'JavaScript',
    author: 'softwaretechnik-berlin',
    categories: ['from-dbml'],
  },
  {
    name: 'dbmlgraph',
    description:
      'CLI that turns a DBML schema into LLM-ready markdown docs and a searchable knowledge graph.',
    href: 'https://github.com/verryp/dbmlgraph',
    repo: 'verryp/dbmlgraph',
    language: 'TypeScript',
    author: 'Verry Anto Paulus',
    categories: ['from-dbml'],
  },
  {
    name: 'Scafoldr',
    description: 'DBML-powered code scaffolding — generate application code from your schema.',
    href: 'https://scafoldr.com/code-generator',
    author: 'Scafoldr',
    categories: ['from-dbml'],
  },
];
