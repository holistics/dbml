/**
 * The worked example, kept here so the tests, the playground and the docs read one file rather
 * than three drifting copies of it.
 *
 * It is the DBX production estate as it is actually drawn today, not a trimmed version of it:
 * two public entry points, four internal proxies, three products sharing one private network,
 * and the ETL path out to the warehouse. A small example hides the problems a drawing tool
 * exists to solve, which are all problems of scale.
 *
 * A NODE IS AN ICON AND A NAME. The protocol and the host live on the LINE, because that is
 * what they describe: the same server answers on more than one of them, and the conversation is
 * the thing being named.
 */
export const PACK_FILE = `// A pack is a file of vocabulary. Ship one per cloud, per team, per house style.
//
// IT USED TO BE ELEVEN LINES AND IT IS NOW TWO, because a brand is no longer a word at all.
// Postgres, Mongo, Redis and HAProxy are settings now:
//
//   Database users_db [type: 'postgres']
//
// A pack is left with what only a pack can do: name a ROLE the built-ins do not have, and
// overrule one they do.

// overruling a built-in word, which is how a house style travels
Kind Firewall [icon: firewall, color: '#c0453a']

// a ROLE the built-ins do not have. A brand needs no Kind at all: it is a [type: ...]
Kind Lakehouse [icon: graph, color: '#4a7c59']
`;

export const MAIN_FILE = `---
title: DBX network diagram
owner: platform-team
updated: 2026-10-12
diagram_type: arch
---

Project dbx {
  Note: 'The DBX production estate'
}

use * from './packs/devops.arch'

// ── outside ───────────────────────────────────────────────────────────────────
Internet "Internet" as net_dbdiagram
Internet "Internet" as net_dbdocs
CDN "Cloudflare" as cf_dbdiagram {
  type: 'cloudflare'
}
CDN "Cloudflare" as cf_dbdocs {
  type: 'cloudflare'
}
Client "DBX Engineers" as dbx_eng
VPN "Tailscale" as tailscale
Team "Holistics Data Analytics" as holistics
Warehouse "Google BigQuery" as bigquery {
  type: 'bigquery'
}

// ── the managed edge, outside the private network ─────────────────────────────
LoadBalancer "dbdiagram-do-lb-be" as dbdiagram_do_lb_be
LoadBalancer "dbdiagram-do-lb-ws" as dbdiagram_do_lb_ws
Note do_lbs_dbdiagram { 'DigitalOcean Load Balancers' }

CDN "DBDiagram Frontend - AWS CloudFront" as dbdiagram_fe {
  type: 'aws'
}

LoadBalancer "dbdocs-do-lb-fe" as dbdocs_do_lb_fe
LoadBalancer "dbdocs-do-lb-be" as dbdocs_do_lb_be
Note do_lbs_dbdocs { 'DigitalOcean Load Balancers' }

Server "runSQL Frontend SSR server" as runsql_ssr
Server "runSQL Backend Server" as runsql_be

// ── dbdiagram ─────────────────────────────────────────────────────────────────
Proxy "dbdiagram-lb-1" as dbdiagram_lb1 {
  type: 'haproxy'
}
Proxy "dbdiagram-lb-2" as dbdiagram_lb2 {
  type: 'haproxy'
}
Server "dbdiagram API1" as api1
Server "dbdiagram API2" as api2
Server "dbdiagram WS1" as ws1
Server "dbdiagram WS2" as ws2
Database "dbdiagram mongodb 1" as mongo1 {
  type: 'mongodb'
}
Database "dbdiagram mongodb 2" as mongo2 {
  type: 'mongodb'
}
Database "dbdiagram mongodb 3" as mongo3 {
  type: 'mongodb'
}
Cache "Redis Cache" as redis {
  type: 'redis'
}

// ── dbdocs ────────────────────────────────────────────────────────────────────
Proxy "dbdocs lb-1" as dbdocs_lb1 {
  type: 'haproxy'
}
Proxy "dbdocs lb-2" as dbdocs_lb2 {
  type: 'haproxy'
}
Server "DBDocs Web servers" as dbdocs_web
Server "DBDocs API Servers" as dbdocs_api
Database "Master" as dbdocs_pg_master {
  type: 'postgres'
}
Database "Standby" as dbdocs_pg_standby {
  type: 'postgres'
}

// ── runSQL ────────────────────────────────────────────────────────────────────
Database "runSQL Postgres Main DB" as runsql_pg {
  type: 'postgres'
}
Container "runSQL Sandbox DBs servers" as runsql_sandbox {
  type: 'docker'
}
Server "runsql-pgbouncer" as runsql_pgbouncer

// ── dbx ai ────────────────────────────────────────────────────────────────────
Server "dbx-orca-1" as orca1
Server "dbx-orca-2" as orca2
Proxy "dbx-ai-lb" as dbx_ai_lb {
  type: 'haproxy'
}
Database "dbx-ai pgvector" as dbx_pgvector {
  type: 'postgres'
}
Pipeline "Airbyte ETL" as airbyte {
  type: 'https://avatars.githubusercontent.com/u/59758427?s=200&v=4'
}

// ── operations ────────────────────────────────────────────────────────────────
Monitoring "Grafana" as grafana {
  type: 'grafana'
}
Monitoring "Grafana loki" as loki {
  type: 'grafana'
}
Monitoring "Prometheus (monitoring)" as prometheus {
  type: 'prometheus'
}
Firewall "OSSEC" as ossec
Server "Deployment server" as deploy

// A group lists names, and a name may be a node OR another group, so nesting needs no new
// syntax and moving something between containers is one line.
Group "dbdiagram API servers" as dbdiagram_api { api1 api2 }
Group "dbdiagram Websocket servers" as dbdiagram_ws { ws1 ws2 }
Group "dbdiagram Internal Proxy" as dbdiagram_proxy { dbdiagram_lb1 dbdiagram_lb2 }
Group "dbdiagram mongodb replica set" as mongo_rs { mongo1 mongo2 mongo3 }
Group "DBDocs Internal Proxy" as dbdocs_proxy { dbdocs_lb1 dbdocs_lb2 }
Group "DBDocs Postgres Main DBs" as dbdocs_pg { dbdocs_pg_master dbdocs_pg_standby }
Group "dbx-ai-orca" as dbx_ai_orca { orca1 orca2 }
Group "Monitoring system" as monitoring { grafana loki prometheus }

Group "Production servers" as production [style: dashed] {
  dbdiagram_proxy
  dbdiagram_api
  dbdiagram_ws
  mongo_rs
  redis
  dbdocs_proxy
  dbdocs_web
  dbdocs_api
  dbdocs_pg
  dbx_ai_orca
  dbx_ai_lb
  dbx_pgvector
  airbyte
  runsql_pg
  runsql_sandbox
  runsql_pgbouncer
}

Group "Private network" as private_net {
  production
  monitoring
  ossec
  deploy
}

// Metadata can land on something declared anywhere, including another file.
Metadata api1 {
  owner: 'platform-team'
  runbook: 'wiki/dbdiagram-api'
}

// ── what talks to what ────────────────────────────────────────────────────────
// The protocol and the host belong on the line, not inside a box: they describe the
// conversation, and the same server answers on more than one of them.
Link: net_dbdiagram > cf_dbdiagram
Link: cf_dbdiagram > dbdiagram_fe         [proto: HTTPS, host: 'dbdiagram.io']
Link: cf_dbdiagram > dbdiagram_do_lb_be   [proto: HTTPS, host: 'api.dbdiagram.com']
Link: cf_dbdiagram > dbdiagram_do_lb_ws   [proto: HTTPS, host: 'ws.dbdiagram.com']
Link: do_lbs_dbdiagram - dbdiagram_do_lb_be

Link: dbdiagram_do_lb_be > dbdiagram_lb1
Link: dbdiagram_do_lb_ws > dbdiagram_lb2
Link: dbdiagram_proxy > dbdiagram_api
Link: dbdiagram_proxy > dbdiagram_ws

// A line may end on a container. The API talks to the replica set, not to whichever
// member happens to be primary this afternoon.
Link: dbdiagram_api > mongo_rs
Link: dbdiagram_api > redis
Link: dbdiagram_ws > redis

Link: net_dbdocs > cf_dbdocs
Link: cf_dbdocs > dbdocs_do_lb_fe         [proto: HTTPS, host: 'dbdocs.io']
Link: cf_dbdocs > dbdocs_do_lb_be         [proto: HTTPS, host: 'api.dbdocs.io']
Link: do_lbs_dbdocs - dbdocs_do_lb_fe
Link: dbdocs_do_lb_fe > dbdocs_lb1
Link: dbdocs_do_lb_be > dbdocs_lb2
Link: dbdocs_proxy > dbdocs_web
Link: dbdocs_proxy > dbdocs_api
Link: dbdocs_api > dbdocs_pg

Link: cf_dbdocs > runsql_ssr              [proto: HTTPS, host: 'runsql.com']
Link: cf_dbdocs > runsql_be               [proto: HTTPS, host: 'api.runsql.com']
Link: cf_dbdocs > runsql_pgbouncer        [proto: TCP, host: '*.sandbox.runsql.com']
Link: runsql_be > runsql_pg
Link: runsql_pgbouncer > runsql_sandbox
Link: runsql_sandbox > runsql_pg

Link: dbx_ai_lb > dbx_ai_orca
Link: dbx_ai_orca > dbx_pgvector
Link: mongo_rs > airbyte
Link: dbdocs_pg > airbyte
Link: airbyte > bigquery                  [proto: SSL]
Link: bigquery > holistics

Link: dbx_eng > tailscale                 [proto: SSH]
Link: tailscale > deploy                  [proto: SSH]
Link: dbx_eng > production                [proto: HTTPS]
Link: deploy > production                 [proto: SSH]

Link: production > prometheus
Link: production > ossec
Link: prometheus > grafana
Link: loki > grafana
Link: ossec > loki
`;

/**
 * The same estate as one document, with the vocabulary inline instead of imported.
 *
 * This is the shape a cloud editor has: no filename, no second file, no import. It is here
 * rather than in the playground so that a test compiles it, because a sample nobody compiles
 * rots the first time the language moves.
 */
export const INLINE_FILE = `---
title: DBX network diagram
owner: platform-team
updated: 2026-10-12
diagram_type: arch
---

Project dbx {
  Note: 'The DBX production estate'
}

// The vocabulary. In a project with files this is a pack you import:
//   use * from './packs/devops.arch'
//
// A brand is a setting, not a word:  Database users_db [type: 'postgres']
// So a pack is left with what only a pack can do: name a ROLE the built-ins lack, and
// overrule one they have.

// overruling a built-in word, which is how a house style travels
Kind Firewall [icon: firewall, color: '#c0453a']

// a ROLE the built-ins do not have. A brand needs no Kind at all: it is a [type: ...]
Kind Lakehouse [icon: graph, color: '#4a7c59']

// ── outside ───────────────────────────────────────────────────────────────────
Internet "Internet" as net_dbdiagram
Internet "Internet" as net_dbdocs
CDN "Cloudflare" as cf_dbdiagram {
  type: 'cloudflare'
}
CDN "Cloudflare" as cf_dbdocs {
  type: 'cloudflare'
}
Client "DBX Engineers" as dbx_eng
VPN "Tailscale" as tailscale
Team "Holistics Data Analytics" as holistics
Warehouse "Google BigQuery" as bigquery {
  type: 'bigquery'
}

// ── the managed edge, outside the private network ─────────────────────────────
LoadBalancer "dbdiagram-do-lb-be" as dbdiagram_do_lb_be
LoadBalancer "dbdiagram-do-lb-ws" as dbdiagram_do_lb_ws
Note do_lbs_dbdiagram { 'DigitalOcean Load Balancers' }

CDN "DBDiagram Frontend - AWS CloudFront" as dbdiagram_fe {
  type: 'aws'
}

LoadBalancer "dbdocs-do-lb-fe" as dbdocs_do_lb_fe
LoadBalancer "dbdocs-do-lb-be" as dbdocs_do_lb_be
Note do_lbs_dbdocs { 'DigitalOcean Load Balancers' }

Server "runSQL Frontend SSR server" as runsql_ssr
Server "runSQL Backend Server" as runsql_be

// ── dbdiagram ─────────────────────────────────────────────────────────────────
Proxy "dbdiagram-lb-1" as dbdiagram_lb1 {
  type: 'haproxy'
}
Proxy "dbdiagram-lb-2" as dbdiagram_lb2 {
  type: 'haproxy'
}
Server "dbdiagram API1" as api1
Server "dbdiagram API2" as api2
Server "dbdiagram WS1" as ws1
Server "dbdiagram WS2" as ws2
Database "dbdiagram mongodb 1" as mongo1 {
  type: 'mongodb'
}
Database "dbdiagram mongodb 2" as mongo2 {
  type: 'mongodb'
}
Database "dbdiagram mongodb 3" as mongo3 {
  type: 'mongodb'
}
Cache "Redis Cache" as redis {
  type: 'redis'
}

// ── dbdocs ────────────────────────────────────────────────────────────────────
Proxy "dbdocs lb-1" as dbdocs_lb1 {
  type: 'haproxy'
}
Proxy "dbdocs lb-2" as dbdocs_lb2 {
  type: 'haproxy'
}
Server "DBDocs Web servers" as dbdocs_web
Server "DBDocs API Servers" as dbdocs_api
Database "Master" as dbdocs_pg_master {
  type: 'postgres'
}
Database "Standby" as dbdocs_pg_standby {
  type: 'postgres'
}

// ── runSQL ────────────────────────────────────────────────────────────────────
Database "runSQL Postgres Main DB" as runsql_pg {
  type: 'postgres'
}
Container "runSQL Sandbox DBs servers" as runsql_sandbox {
  type: 'docker'
}
Server "runsql-pgbouncer" as runsql_pgbouncer

// ── dbx ai ────────────────────────────────────────────────────────────────────
Server "dbx-orca-1" as orca1
Server "dbx-orca-2" as orca2
Proxy "dbx-ai-lb" as dbx_ai_lb {
  type: 'haproxy'
}
Database "dbx-ai pgvector" as dbx_pgvector {
  type: 'postgres'
}
Pipeline "Airbyte ETL" as airbyte {
  type: 'https://avatars.githubusercontent.com/u/59758427?s=200&v=4'
}

// ── operations ────────────────────────────────────────────────────────────────
Monitoring "Grafana" as grafana {
  type: 'grafana'
}
Monitoring "Grafana loki" as loki {
  type: 'grafana'
}
Monitoring "Prometheus (monitoring)" as prometheus {
  type: 'prometheus'
}
Firewall "OSSEC" as ossec
Server "Deployment server" as deploy

// A group lists names, and a name may be a node OR another group, so nesting needs no new
// syntax and moving something between containers is one line.
Group "dbdiagram API servers" as dbdiagram_api { api1 api2 }
Group "dbdiagram Websocket servers" as dbdiagram_ws { ws1 ws2 }
Group "dbdiagram Internal Proxy" as dbdiagram_proxy { dbdiagram_lb1 dbdiagram_lb2 }
Group "dbdiagram mongodb replica set" as mongo_rs { mongo1 mongo2 mongo3 }
Group "DBDocs Internal Proxy" as dbdocs_proxy { dbdocs_lb1 dbdocs_lb2 }
Group "DBDocs Postgres Main DBs" as dbdocs_pg { dbdocs_pg_master dbdocs_pg_standby }
Group "dbx-ai-orca" as dbx_ai_orca { orca1 orca2 }
Group "Monitoring system" as monitoring { grafana loki prometheus }

Group "Production servers" as production [style: dashed] {
  dbdiagram_proxy
  dbdiagram_api
  dbdiagram_ws
  mongo_rs
  redis
  dbdocs_proxy
  dbdocs_web
  dbdocs_api
  dbdocs_pg
  dbx_ai_orca
  dbx_ai_lb
  dbx_pgvector
  airbyte
  runsql_pg
  runsql_sandbox
  runsql_pgbouncer
}

Group "Private network" as private_net {
  production
  monitoring
  ossec
  deploy
}

// Metadata can land on something declared anywhere, including another file.
Metadata api1 {
  owner: 'platform-team'
  runbook: 'wiki/dbdiagram-api'
}

// ── what talks to what ────────────────────────────────────────────────────────
// The protocol and the host belong on the line, not inside a box: they describe the
// conversation, and the same server answers on more than one of them.
Link: net_dbdiagram > cf_dbdiagram
Link: cf_dbdiagram > dbdiagram_fe         [proto: HTTPS, host: 'dbdiagram.io']
Link: cf_dbdiagram > dbdiagram_do_lb_be   [proto: HTTPS, host: 'api.dbdiagram.com']
Link: cf_dbdiagram > dbdiagram_do_lb_ws   [proto: HTTPS, host: 'ws.dbdiagram.com']
Link: do_lbs_dbdiagram - dbdiagram_do_lb_be

Link: dbdiagram_do_lb_be > dbdiagram_lb1
Link: dbdiagram_do_lb_ws > dbdiagram_lb2
Link: dbdiagram_proxy > dbdiagram_api
Link: dbdiagram_proxy > dbdiagram_ws

// A line may end on a container. The API talks to the replica set, not to whichever
// member happens to be primary this afternoon.
Link: dbdiagram_api > mongo_rs
Link: dbdiagram_api > redis
Link: dbdiagram_ws > redis

Link: net_dbdocs > cf_dbdocs
Link: cf_dbdocs > dbdocs_do_lb_fe         [proto: HTTPS, host: 'dbdocs.io']
Link: cf_dbdocs > dbdocs_do_lb_be         [proto: HTTPS, host: 'api.dbdocs.io']
Link: do_lbs_dbdocs - dbdocs_do_lb_fe
Link: dbdocs_do_lb_fe > dbdocs_lb1
Link: dbdocs_do_lb_be > dbdocs_lb2
Link: dbdocs_proxy > dbdocs_web
Link: dbdocs_proxy > dbdocs_api
Link: dbdocs_api > dbdocs_pg

Link: cf_dbdocs > runsql_ssr              [proto: HTTPS, host: 'runsql.com']
Link: cf_dbdocs > runsql_be               [proto: HTTPS, host: 'api.runsql.com']
Link: cf_dbdocs > runsql_pgbouncer        [proto: TCP, host: '*.sandbox.runsql.com']
Link: runsql_be > runsql_pg
Link: runsql_pgbouncer > runsql_sandbox
Link: runsql_sandbox > runsql_pg

Link: dbx_ai_lb > dbx_ai_orca
Link: dbx_ai_orca > dbx_pgvector
Link: mongo_rs > airbyte
Link: dbdocs_pg > airbyte
Link: airbyte > bigquery                  [proto: SSL]
Link: bigquery > holistics

Link: dbx_eng > tailscale                 [proto: SSH]
Link: tailscale > deploy                  [proto: SSH]
Link: dbx_eng > production                [proto: HTTPS]
Link: deploy > production                 [proto: SSH]

Link: production > prometheus
Link: production > ossec
Link: prometheus > grafana
Link: loki > grafana
Link: ossec > loki
`;

export const EXAMPLE_ENTRY = '/main.arch.dbml';

export const EXAMPLE_FILES: Record<string, string> = {
  '/main.arch.dbml': MAIN_FILE,
  '/packs/devops.arch.dbml': PACK_FILE,
};

/**
 * DBML DRAWING ITSELF, and the reason this export exists.
 *
 * The estate example proves the language can describe a network, which is what the pictures it
 * was lifted from happened to be. This one asks a harder question: can the same twelve words
 * describe a CODEBASE?
 *
 * TWO THINGS WENT WRONG BEFORE THIS VERSION, and both are worth recording because they are
 * the kind of mistake a diagramming language invites.
 *
 * The first draft drew one box per file. Thirty boxes, every one of them a filename, and the
 * thing a reader actually wants — what happens to the text between being typed and being
 * drawn — buried underneath. So a box here is a STAGE, one per step that changes the shape of
 * the data, and there are fifteen of them.
 *
 * The second draft moved the file listings into free-standing `Note` boxes inside each
 * container. That is reference material competing with the drawing for the same square
 * inches: the layout engine placed each sticky wherever it fitted, the lines had to route
 * around them, and the picture got worse the more reference material it carried. A note
 * belongs TO something. So the listings are notes ON the containers, written as markdown, and
 * the renderer shows them on hover rather than painting them on the canvas. The drawing is the
 * pipeline; the notes are what you ask for when you want the detail.
 *
 * One gap is left standing rather than papered over: a line carries `proto` and `host`, which
 * are network words, so `proto` is doing duty as a generic edge label and reads oddly for an
 * import.
 */
export const SELF_FILE = `---
title: DBML, drawn in DBML
owner: dbx
updated: 2026-10-13
diagram_type: arch
---

Project dbml_itself {
  Note: 'What happens to a file between being typed and being drawn'
}

// Not one of the thirty-one built-in words describes code, so every word here is declared.
// The vocabulary opening by seven is the vocabulary working; it is also the argument for
// shipping a second pack next to the devops one.
Kind Stage [icon: chip, color: '#3f6ea8']
Kind Shape [icon: graph, color: '#4a7c59']
Kind Words [icon: tag]
Kind Closed [icon: lock, color: '#8a5a2b']
Kind Author [icon: person]
Kind Canvas [icon: browser]
Kind Lib [icon: nodejs]

Author "Whoever writes the file" as author

// ── @dbml/parse: the front end both dialects share ────────────────────────────
// A NODE TAKES A NOTE THE SAME WAY A CONTAINER DOES: a body with a \`Note:\` in it. Nothing
// about the syntax changes because the box is smaller.
Stage "Lexer" as lex {
  Note: '''
  **642 lines, and not one DBML word in them.**

  It lexes identifiers, strings, numbers and punctuation. \`Table\` is
  an identifier to it, and so is \`Server\`.

  - \`allowFrontMatter\` is the one switch the dialect turns on here
  - \`---\` ... \`---\` comes back as a single trivia token, fences on
  '''
}

Stage "Parser" as parse {
  Note: '''
  **1623 lines with no mention of \`ElementKind\`.**

  One generic \`elementDeclaration()\` reads \`Keyword name [settings] { body }\`
  and does not care which keyword it was.

  - \`allowBodylessElement\` lets \`Server api1\` stand on its own
  - an architecture file is mostly bodyless; a DBML file is mostly bodies
  '''
}
Stage "File graph & cache" as filegraph {
  Note: '''
  **Borrowed whole, and not adapted.**

  \`use * from './packs/devops.arch'\` is DBML's own import, its own
  resolver and its own cache.

  - a specifier with no \`.dbml\` on it gets one appended
  - which is why the suffix is \`.arch.dbml\` and not \`.dbml.arch\`
  - the reverse misses, in every spelling
  '''
}
Shape "Tokens" as tokens
Shape "Syntax tree" as ast
Words "DBML's 16 elements" as dbmlwords

// ── the architecture dialect ──────────────────────────────────────────────────
Stage "Three dialect switches" as dialect {
  Note: '''
  **Three switches, all off for DBML.**

  - \`lexer.allowFrontMatter\`
  - \`parser.allowBodylessElement\`
  - an injectable module list, passed EMPTY here

  All 2043 DBML tests pass unchanged with all three present.
  Turning the bodyless one on by default would cost exactly one
  fuzz test file, which is the measured price of never branching.
  '''
}
Stage "Bind & interpret" as bind {
  Note: '''
  **Where this dialect stops borrowing.**

  DBML's 16 modules resolve names against a schema. An architecture
  file has no schema, so binding is written here instead.

  - \`read.ts\` is the only file that touches a syntax node
  - everything above it speaks in names, settings and ranges
  - 18 of 20 architecture constructs parse through DBML unchanged
  '''
}
Words "31 kinds, 84 icon names" as archvocab {
  Note: '''
  **Closed at any moment, opened by one declaration.**

  A model needs a closed set so \`Microservice\` cannot silently draw a
  blank box. A person needs an open one, because no estate fits
  thirty-one words.

  - \`Kind Mongo [icon: mongodb]\` adds a word
  - \`Kind Firewall [icon: firewall, color: '#c0453a']\` overrules one
  - the grammar is untouched either way
  '''
}
Shape "NetworkModel" as model {
  Note: '''
  **The whole contract between the two repositories.**

  Types and two predicates. The moment a function lands in it that
  does real work, the contract has become a library and the next
  producer has to adopt its behaviour as well as its shape.

  - \`kinds\`, \`elements\`, \`links\`, \`roots\`, \`frontMatter\`
  - anything that can produce it can be drawn
  '''
}

// ── the closed renderer, a separate repository ────────────────────────────────
Closed "Measure boxes" as measure {
  Note: '''
  **Measured first, placed later.**

  That order is what makes the layout engine swappable: ELK, a grid,
  or a person dragging all take a box whose size is already settled
  by the text inside it.

  - a node is an icon and a caption, with no frame
  - a note is NOT measured; it has no box to take up room
  '''
}
Closed "Place boxes" as place {
  Note: '''
  **ELK places, with a grid behind it.**

  - \`elk.layered\`, containers as real nesting
  - saved overrides go on top: engine first, then the sidecar
  - only leaves are saved; a container's box is always re-derived
  '''
}
Closed "Route lines" as route {
  Note: '''
  **A\\* over an orthogonal visibility grid.**

  ELK places the boxes; the lines are ours, because ELK's routing
  put 1321px of line directly on top of other line in the worked
  example. That is now 0.

  - \`anchorBox()\` — sideways on the icon, vertically on the box
  - \`fanOut()\` — lines sharing a side fan out, ordered by the far end
  - \`separateLanes()\` — a pass for the corridors still shared
  '''
}
Closed "Paint SVG" as paint {
  Note: '''
  **No canvas and no WebGL: the export is what is on screen.**

  Colours arrive as \`var()\` references, so the page's theme owns
  them and the same renderer sits in a playground, a docs page and
  a product that each think they own the palette.

  - dimming is a class, so a selection costs no geometry
  - the drawings live here; the NAMES live in the open repo
  '''
}
Lib "elkjs" as elk

// ── the playground ────────────────────────────────────────────────────────────
Canvas "Monaco editor" as editor
Canvas "Pinia stores" as stores {
  Note: '''
  **Two compilers, one editor.**

  - \`archStore\` compiles, and decides whether there IS a diagram
  - \`parserStore\` is the DBML side, suppressed on an architecture
    file so it does not report 154 problems about a language the
    document is not written in
  '''
}
Canvas "Architecture pane" as pane

// A container's note is markdown, and it is where the file listing lives. A triple-quoted
// string keeps its line breaks, so a list stays a list.
Group "@dbml/parse — open, vocabulary-neutral" as frontend {
  lex
  parse
  filegraph
  tokens
  ast

  Note: '''
  **The front end, shared by both dialects.**

  - \`src/core/lexer/\` — 642 lines, not one DBML word
  - \`src/core/parser/\` — 1623 lines, no mention of \`ElementKind\`
  - \`src/compiler/\` — layout, modules, dialect options
  - \`src/core/types/\`, \`src/utils/\`

  The lexer names no DBML word and the parser has a single generic
  \`elementDeclaration()\`. That is the whole reason a second dialect
  needs no fork of either.
  '''
}

Group "DBML's own vocabulary" as vocabulary_dbml {
  dbmlwords

  Note: '''
  **\`src/core/global_modules/\` — 10,362 lines, 16 modules.**

  - \`table\`, \`tablePartial\`, \`tableGroup\`, \`records\`
  - \`ref\`, \`dep\`, \`enum\`, \`indexes\`
  - \`project\`, \`note\`, \`metadata\`, \`diagramView\`
  - \`use\`, \`program\`, \`checks\`, \`schema\`

  An architecture file is compiled with this list EMPTY, which is how
  no DBML element can claim a node in it.
  '''
}

Group "The architecture dialect: open, the new language" as archpkg {
  dialect
  bind
  archvocab
  model

  Note: '''
  **The dialect. 1368 lines, seven files.**

  - \`compile.ts\` — bind and interpret, this dialect's own
  - \`read.ts\` — 137 lines, the ONLY file that touches a syntax node
  - \`vocabulary.ts\` — 31 built-in kinds
  - \`icons.ts\` — 84 names, and no drawings
  - \`model.ts\` — \`NetworkModel\`, the renderer's input contract
  - \`example.ts\` — this file

  If DBML moves its AST, \`read.ts\` moves and nothing else does.
  '''
}

Group "dbx-graph-renderer — closed, separate repository" as renderer [style: dashed] {
  measure
  place
  route
  paint
  elk

  Note: '''
  **Closed, and depends on no parser.**

  - \`scene/\` — measure every box before anything is placed
  - \`layout/\` — ELK, a grid fallback, saved overrides
  - \`route/\` — A* over an orthogonal visibility grid
  - \`paint/\` — SVG, and \`icons.ts\`: the drawings, not the names
  - \`interact/\` — wheel scrolls, Cmd+wheel zooms, middle drag pans

  Anything that can produce a \`NetworkModel\` can be drawn here.
  '''
}

Group "dbml-playground" as playground {
  editor
  stores
  pane

  Note: '''
  **Where both dialects are tried on.**

  - \`stores/archStore.ts\` — compiles, decides if there IS a diagram
  - \`stores/parserStore.ts\` — the DBML side, gated so architecture
    files do not collect 154 red squiggles
  - \`components/panes/\` — the canvas, hidden when there is nothing to draw
  - \`components/editor/\` — Monaco
  '''
}

Metadata bind {
  reads: 'read.ts, 137 lines'
  owns: 'binding and interpretation, deliberately not shared with DBML'
}

Metadata archvocab {
  pairs_with: 'the renderer icons.ts, asserted by a test on the closed side'
}

// ── what becomes what ─────────────────────────────────────────────────────────
Link: author > editor   [proto: 'types .arch.dbml']
Link: editor > stores
Link: stores > dialect
Link: dialect > filegraph [proto: 'front matter, bodyless elements, no modules']
Link: filegraph > lex
Link: lex > tokens
Link: tokens > parse
Link: parse > ast
Link: ast > dbmlwords   [proto: 'DBML only']
Link: ast > bind        [proto: 'architecture only']
Link: bind > archvocab
Link: bind > model
Link: model > measure   [proto: 'the whole contract between the repositories']
Link: measure > place
Link: place > elk
Link: place > route
Link: route > paint
Link: paint > pane      [proto: SVG]
Link: stores > pane
`;

/**
 * A BOOK, DRAWN WITH A VOCABULARY MEANT FOR SERVERS.
 *
 * This one is here as evidence rather than as decoration. Everything else in this file
 * describes software, which is the domain the language was lifted from, so none of it can say
 * whether the design generalises or merely fits the examples it was built against.
 *
 * So: five nights of Adlerian dialogue, drawn as an argument. A box is a premise, a claim, a
 * refuted belief or a practice; a line is `leads to` or `refutes`; a container is a night.
 *
 * WHAT IT COST, written down because a working example is a bad place to hide a limitation.
 *
 * The four link operators are `>`, `<`, `<>` and `-`. An argument wants `refutes`, `supports`
 * and `requires`, and all three end up spelled on the line as `[proto: 'bác bỏ']` — a network
 * word doing duty as a generic label for the third time in this package. That is now the
 * clearest signal in the repository that the LINE's vocabulary is the part of this language
 * still shaped by where it was lifted from. The boxes generalised; the lines did not.
 *
 * Nothing else bent. None of the thirty-one built-in kinds is any use here and the vocabulary
 * opened by six without complaint, which is the `Kind` design working on a domain nobody had
 * it in mind for. Vietnamese identifiers lex as identifiers, diacritics and all, so
 * `mục_đích_luận` is a name and `Tiền_đề` is a kind.
 */
export const BOOK_FILE = `---
title: Dám bị ghét
authors: Kishimi Ichiro, Koga Fumitake
form: năm đêm đối thoại
diagram_type: arch
---

Project dam_bi_ghet {
  Note: 'Tâm lý học Adler, đọc như một lập luận chứ không phải một mục lục'
}

// Không một từ nào trong ba mươi mốt từ có sẵn mô tả được một luận điểm.
Kind Tiền_đề [icon: key, color: '#3f6ea8']
Kind Luận_điểm [icon: chip]
Kind Sai_lầm [icon: warning, color: '#c0453a']
Kind Thực_hành [icon: rocket, color: '#4a7c59']
Kind Kết_quả [icon: check, color: '#b2761c']
Kind Người [icon: person]

Người "Alfred Adler" as adler
Người "Socrates" as socrates

// ── Đêm thứ nhất ──────────────────────────────────────────────────────────────
Sai_lầm "Nguyên nhân luận" as nguyên_nhân_luận
Tiền_đề "Mục đích luận" as mục_đích_luận
Sai_lầm "Sang chấn tâm lý" as sang_chấn
Luận_điểm "Lối sống là một lựa chọn" as lối_sống
Thực_hành "Can đảm để thay đổi" as can_đảm

// ── Đêm thứ hai ───────────────────────────────────────────────────────────────
Tiền_đề "Mọi phiền muộn đều là quan hệ người với người" as quan_hệ
Luận_điểm "Cảm giác tự ti là chủ quan" as tự_ti
Sai_lầm "Phức cảm tự ti" as phức_cảm
Sai_lầm "Phức cảm tự tôn" as tự_tôn
Sai_lầm "Xem đời là cuộc cạnh tranh" as cạnh_tranh
Sai_lầm "Tranh giành quyền lực" as tranh_giành
Luận_điểm "Ba nhiệm vụ cuộc đời" as nhiệm_vụ
Sai_lầm "Lời nói dối cuộc đời" as nói_dối

// ── Đêm thứ ba ────────────────────────────────────────────────────────────────
Sai_lầm "Nhu cầu được thừa nhận" as thừa_nhận
Thực_hành "Phân chia nhiệm vụ" as phân_chia
Kết_quả "Tự do là dám bị ghét" as tự_do

// ── Đêm thứ tư ────────────────────────────────────────────────────────────────
Sai_lầm "Quan hệ theo chiều dọc" as quan_hệ_dọc
Thực_hành "Quan hệ theo chiều ngang" as quan_hệ_ngang
Sai_lầm "Khen ngợi và mắng mỏ" as khen_mắng
Thực_hành "Khích lệ lòng can đảm" as khích_lệ
Tiền_đề "Cảm thức cộng đồng" as cộng_đồng
Luận_điểm "Có mặt ở đây đã là có giá trị" as giá_trị

// ── Đêm thứ năm ───────────────────────────────────────────────────────────────
Thực_hành "Chấp nhận bản thân" as chấp_nhận
Thực_hành "Tin tưởng người khác" as tin_tưởng
Thực_hành "Cống hiến cho người khác" as cống_hiến
Sai_lầm "Đời là một đường thẳng" as đường_thẳng
Tiền_đề "Đời là những khoảnh khắc nối tiếp" as khoảnh_khắc
Thực_hành "Dám bình thường" as bình_thường
Kết_quả "Hạnh phúc là cảm thấy mình có ích" as hạnh_phúc

Group "Đêm thứ nhất: hãy phủ nhận sang chấn tâm lý" as đêm1 {
  nguyên_nhân_luận  mục_đích_luận  sang_chấn  lối_sống  can_đảm

  Note: '''
  **Người ta không bị quá khứ đẩy, mà bị mục đích kéo.**

  - \`nguyên nhân luận\` giải thích hiện tại bằng quá khứ, rồi kết luận là không đổi được
  - \`mục đích luận\` hỏi: cậu đang theo đuổi điều gì khi giữ nguyên mình như thế này
  - cơn giận không bùng ra, nó được ngụy tạo để đạt một mục đích
  '''
}

Group "Đêm thứ hai: mọi phiền muộn đều bắt nguồn từ quan hệ" as đêm2 {
  quan_hệ  tự_ti  phức_cảm  tự_tôn  cạnh_tranh  tranh_giành  nhiệm_vụ  nói_dối

  Note: '''
  **Cảm giác tự ti là nhiên liệu. Phức cảm tự ti là một cái cớ.**

  - tự ti là so với \`bản thân lý tưởng\`, không phải so với người khác
  - \`vì A nên không làm được B\` là bao biện, không phải nguyên nhân
  - khoe khoang và bi quan là cùng một thứ: phức cảm tự tôn
  - ba nhiệm vụ: công việc, bạn bè, tình yêu
  '''
}

Group "Đêm thứ ba: bỏ qua nhiệm vụ của người khác" as đêm3 {
  thừa_nhận  phân_chia  tự_do

  Note: '''
  **Một câu hỏi duy nhất: kết quả cuối cùng ai chịu?**

  - trả lời xong là biết nhiệm vụ đó của ai
  - không can thiệp vào nhiệm vụ người khác, cũng không cho ai can thiệp vào mình
  - bị ghét là cái giá của tự do, không phải là thất bại
  '''
}

Group "Đêm thứ tư: trung tâm thế giới nằm ở đâu" as đêm4 {
  quan_hệ_dọc  quan_hệ_ngang  khen_mắng  khích_lệ  cộng_đồng  giá_trị

  Note: '''
  **Khen và mắng là cùng một thứ: đánh giá từ trên xuống.**

  - cả hai đều giả định một quan hệ dọc
  - thay vào đó là \`cảm ơn\`, \`giúp được tôi rồi\`: lời nói ngang hàng
  - giá trị không đo từ hành vi mà đo từ sự tồn tại
  '''
}

Group "Đêm thứ năm: sống hết mình ngay tại đây, vào lúc này" as đêm5 {
  chấp_nhận  tin_tưởng  cống_hiến  đường_thẳng  khoảnh_khắc  bình_thường  hạnh_phúc

  Note: '''
  **Ba việc này không phải ba bước, mà là một vòng tròn.**

  - \`chấp nhận bản thân\` mới dám tin người khác mà không sợ phản bội
  - tin người khác mới thấy họ là bạn, nên mới cống hiến được
  - cống hiến mới thấy mình có ích, nên mới chấp nhận được bản thân
  - đời không phải đường thẳng đến đích, mà là khiêu vũ từng khoảnh khắc
  '''
}

// ── lập luận chạy như thế nào ─────────────────────────────────────────────────
// \`proto\` ở đây đang làm nhãn chung, không phải giao thức. Xem ghi chú phía trên.
Link: adler > mục_đích_luận  [proto: 'tâm lý học cá nhân']
Link: socrates - adler       [proto: 'đối thoại, không giảng bài']

Link: mục_đích_luận > nguyên_nhân_luận [proto: 'bác bỏ']
Link: mục_đích_luận > sang_chấn        [proto: 'bác bỏ']
Link: mục_đích_luận > lối_sống
Link: lối_sống > can_đảm               [proto: 'đổi được, nhưng phải dám']
Link: can_đảm > quan_hệ

Link: quan_hệ > tự_ti
Link: tự_ti > phức_cảm       [proto: 'khi biến thành cái cớ']
Link: phức_cảm > tự_tôn
Link: quan_hệ > cạnh_tranh   [proto: 'nếu nhìn theo chiều dọc']
Link: cạnh_tranh > tranh_giành
Link: quan_hệ > nhiệm_vụ
Link: nhiệm_vụ > nói_dối     [proto: 'khi tìm cớ né tránh']

Link: nhiệm_vụ > phân_chia
Link: phân_chia > thừa_nhận  [proto: 'bác bỏ']
Link: phân_chia > tự_do
Link: tự_do > cộng_đồng

Link: cạnh_tranh > quan_hệ_dọc
Link: quan_hệ_dọc > khen_mắng
Link: cộng_đồng > quan_hệ_ngang [proto: 'mục tiêu của quan hệ']
Link: quan_hệ_ngang > khích_lệ  [proto: 'thay cho khen và mắng']
Link: khích_lệ > giá_trị
Link: giá_trị > chấp_nhận

Link: chấp_nhận > tin_tưởng
Link: tin_tưởng > cống_hiến
Link: cống_hiến > chấp_nhận  [proto: 'vòng tròn, không phải ba bước']
Link: cống_hiến > hạnh_phúc

Link: khoảnh_khắc > đường_thẳng [proto: 'bác bỏ']
Link: khoảnh_khắc > bình_thường
Link: bình_thường > hạnh_phúc
Link: cộng_đồng > khoảnh_khắc    [proto: 'ngôi sao dẫn đường']
`;
