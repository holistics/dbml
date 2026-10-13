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
// A drawn brand carries its own colour, so most of a pack is a list of names.
// A Kind may also overrule a built-in word, which is how a house style travels.
Kind Firewall   [icon: firewall, color: '#c0453a']
Kind Cloudflare [icon: cloudflare]
Kind CloudFront [icon: aws]
Kind BigQuery   [icon: bigquery]
Kind HAProxy    [icon: haproxy]
Kind Mongo      [icon: mongodb]
Kind Redis      [icon: redis]
Kind Postgres   [icon: postgres]
Kind Docker     [icon: docker]
Kind Grafana    [icon: grafana]
Kind Prometheus [icon: prometheus]
`;

export const MAIN_FILE = `---
title: DBX network diagram
owner: platform-team
updated: 2026-10-12
---

Project dbx {
  diagram_type: 'architecture'
  Note: 'The DBX production estate'
}

use * from './packs/devops.arch'

// ── outside ───────────────────────────────────────────────────────────────────
Internet   net_dbdiagram [name: 'Internet']
Internet   net_dbdocs    [name: 'Internet']
Cloudflare cf_dbdiagram  [name: 'Cloudflare']
Cloudflare cf_dbdocs     [name: 'Cloudflare']
Client     dbx_eng       [name: 'DBX Engineers']
VPN        tailscale     [name: 'Tailscale']
Team       holistics     [name: 'Holistics Data Analytics']
BigQuery   bigquery      [name: 'Google BigQuery']

// ── the managed edge, outside the private network ─────────────────────────────
LoadBalancer dbdiagram_do_lb_be [name: 'dbdiagram-do-lb-be']
LoadBalancer dbdiagram_do_lb_ws [name: 'dbdiagram-do-lb-ws']
Note         do_lbs_dbdiagram   { 'DigitalOcean Load Balancers' }

CloudFront   dbdiagram_fe       [name: 'DBDiagram Frontend - AWS CloudFront']

LoadBalancer dbdocs_do_lb_fe    [name: 'dbdocs-do-lb-fe']
LoadBalancer dbdocs_do_lb_be    [name: 'dbdocs-do-lb-be']
Note         do_lbs_dbdocs      { 'DigitalOcean Load Balancers' }

Server       runsql_ssr         [name: 'runSQL Frontend SSR server']
Server       runsql_be          [name: 'runSQL Backend Server']

// ── dbdiagram ─────────────────────────────────────────────────────────────────
HAProxy  dbdiagram_lb1 [name: 'dbdiagram-lb-1']
HAProxy  dbdiagram_lb2 [name: 'dbdiagram-lb-2']
Server   api1          [name: 'dbdiagram API1']
Server   api2          [name: 'dbdiagram API2']
Server   ws1           [name: 'dbdiagram WS1']
Server   ws2           [name: 'dbdiagram WS2']
Mongo    mongo1        [name: 'dbdiagram mongodb 1']
Mongo    mongo2        [name: 'dbdiagram mongodb 2']
Mongo    mongo3        [name: 'dbdiagram mongodb 3']
Redis    redis         [name: 'Redis Cache']

// ── dbdocs ────────────────────────────────────────────────────────────────────
HAProxy  dbdocs_lb1  [name: 'dbdocs lb-1']
HAProxy  dbdocs_lb2  [name: 'dbdocs lb-2']
Server   dbdocs_web  [name: 'DBDocs Web servers']
Server   dbdocs_api  [name: 'DBDocs API Servers']
Postgres dbdocs_pg_master  [name: 'Master']
Postgres dbdocs_pg_standby [name: 'Standby']

// ── runSQL ────────────────────────────────────────────────────────────────────
Postgres runsql_pg        [name: 'runSQL Postgres Main DB']
Docker   runsql_sandbox   [name: 'runSQL Sandbox DBs servers']
Server   runsql_pgbouncer [name: 'runsql-pgbouncer']

// ── dbx ai ────────────────────────────────────────────────────────────────────
Server   orca1       [name: 'dbx-orca-1']
Server   orca2       [name: 'dbx-orca-2']
HAProxy  dbx_ai_lb   [name: 'dbx-ai-lb']
Postgres dbx_pgvector [name: 'dbx-ai pgvector']
Pipeline airbyte     [name: 'Airbyte ETL']

// ── operations ────────────────────────────────────────────────────────────────
Grafana    grafana    [name: 'Grafana']
Grafana    loki       [name: 'Grafana loki']
Prometheus prometheus [name: 'Prometheus (monitoring)']
Firewall   ossec      [name: 'OSSEC']
Server     deploy     [name: 'Deployment server']

// A group lists names, and a name may be a node OR another group, so nesting needs no new
// syntax and moving something between containers is one line.
Group dbdiagram_api   [name: 'dbdiagram API servers']       { api1  api2 }
Group dbdiagram_ws    [name: 'dbdiagram Websocket servers'] { ws1  ws2 }
Group dbdiagram_proxy [name: 'dbdiagram Internal Proxy']    { dbdiagram_lb1  dbdiagram_lb2 }
Group mongo_rs        [name: 'dbdiagram mongodb replica set'] { mongo1  mongo2  mongo3 }
Group dbdocs_proxy    [name: 'DBDocs Internal Proxy']       { dbdocs_lb1  dbdocs_lb2 }
Group dbdocs_pg       [name: 'DBDocs Postgres Main DBs']    { dbdocs_pg_master  dbdocs_pg_standby }
Group dbx_ai_orca     [name: 'dbx-ai-orca']                 { orca1  orca2 }
Group monitoring      [name: 'Monitoring system']           { grafana  loki  prometheus }

Group production [name: 'Production servers', style: dashed] {
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

Group private_net [name: 'Private network'] {
  production
  monitoring
  ossec
  deploy
}

// Metadata can land on something declared anywhere, including another file.
Metadata api1 {
  owner 'platform-team'
  runbook 'wiki/dbdiagram-api'
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
---

Project dbx {
  diagram_type: 'architecture'
  Note: 'The DBX production estate'
}

// The vocabulary. In a project with files this is a pack you import:
//   use * from './packs/devops.arch'
// A pack is a file of vocabulary. Ship one per cloud, per team, per house style.
// A drawn brand carries its own colour, so most of a pack is a list of names.
// A Kind may also overrule a built-in word, which is how a house style travels.
Kind Firewall   [icon: firewall, color: '#c0453a']
Kind Cloudflare [icon: cloudflare]
Kind CloudFront [icon: aws]
Kind BigQuery   [icon: bigquery]
Kind HAProxy    [icon: haproxy]
Kind Mongo      [icon: mongodb]
Kind Redis      [icon: redis]
Kind Postgres   [icon: postgres]
Kind Docker     [icon: docker]
Kind Grafana    [icon: grafana]
Kind Prometheus [icon: prometheus]

// ── outside ───────────────────────────────────────────────────────────────────
Internet   net_dbdiagram [name: 'Internet']
Internet   net_dbdocs    [name: 'Internet']
Cloudflare cf_dbdiagram  [name: 'Cloudflare']
Cloudflare cf_dbdocs     [name: 'Cloudflare']
Client     dbx_eng       [name: 'DBX Engineers']
VPN        tailscale     [name: 'Tailscale']
Team       holistics     [name: 'Holistics Data Analytics']
BigQuery   bigquery      [name: 'Google BigQuery']

// ── the managed edge, outside the private network ─────────────────────────────
LoadBalancer dbdiagram_do_lb_be [name: 'dbdiagram-do-lb-be']
LoadBalancer dbdiagram_do_lb_ws [name: 'dbdiagram-do-lb-ws']
Note         do_lbs_dbdiagram   { 'DigitalOcean Load Balancers' }

CloudFront   dbdiagram_fe       [name: 'DBDiagram Frontend - AWS CloudFront']

LoadBalancer dbdocs_do_lb_fe    [name: 'dbdocs-do-lb-fe']
LoadBalancer dbdocs_do_lb_be    [name: 'dbdocs-do-lb-be']
Note         do_lbs_dbdocs      { 'DigitalOcean Load Balancers' }

Server       runsql_ssr         [name: 'runSQL Frontend SSR server']
Server       runsql_be          [name: 'runSQL Backend Server']

// ── dbdiagram ─────────────────────────────────────────────────────────────────
HAProxy  dbdiagram_lb1 [name: 'dbdiagram-lb-1']
HAProxy  dbdiagram_lb2 [name: 'dbdiagram-lb-2']
Server   api1          [name: 'dbdiagram API1']
Server   api2          [name: 'dbdiagram API2']
Server   ws1           [name: 'dbdiagram WS1']
Server   ws2           [name: 'dbdiagram WS2']
Mongo    mongo1        [name: 'dbdiagram mongodb 1']
Mongo    mongo2        [name: 'dbdiagram mongodb 2']
Mongo    mongo3        [name: 'dbdiagram mongodb 3']
Redis    redis         [name: 'Redis Cache']

// ── dbdocs ────────────────────────────────────────────────────────────────────
HAProxy  dbdocs_lb1  [name: 'dbdocs lb-1']
HAProxy  dbdocs_lb2  [name: 'dbdocs lb-2']
Server   dbdocs_web  [name: 'DBDocs Web servers']
Server   dbdocs_api  [name: 'DBDocs API Servers']
Postgres dbdocs_pg_master  [name: 'Master']
Postgres dbdocs_pg_standby [name: 'Standby']

// ── runSQL ────────────────────────────────────────────────────────────────────
Postgres runsql_pg        [name: 'runSQL Postgres Main DB']
Docker   runsql_sandbox   [name: 'runSQL Sandbox DBs servers']
Server   runsql_pgbouncer [name: 'runsql-pgbouncer']

// ── dbx ai ────────────────────────────────────────────────────────────────────
Server   orca1       [name: 'dbx-orca-1']
Server   orca2       [name: 'dbx-orca-2']
HAProxy  dbx_ai_lb   [name: 'dbx-ai-lb']
Postgres dbx_pgvector [name: 'dbx-ai pgvector']
Pipeline airbyte     [name: 'Airbyte ETL']

// ── operations ────────────────────────────────────────────────────────────────
Grafana    grafana    [name: 'Grafana']
Grafana    loki       [name: 'Grafana loki']
Prometheus prometheus [name: 'Prometheus (monitoring)']
Firewall   ossec      [name: 'OSSEC']
Server     deploy     [name: 'Deployment server']

// A group lists names, and a name may be a node OR another group, so nesting needs no new
// syntax and moving something between containers is one line.
Group dbdiagram_api   [name: 'dbdiagram API servers']       { api1  api2 }
Group dbdiagram_ws    [name: 'dbdiagram Websocket servers'] { ws1  ws2 }
Group dbdiagram_proxy [name: 'dbdiagram Internal Proxy']    { dbdiagram_lb1  dbdiagram_lb2 }
Group mongo_rs        [name: 'dbdiagram mongodb replica set'] { mongo1  mongo2  mongo3 }
Group dbdocs_proxy    [name: 'DBDocs Internal Proxy']       { dbdocs_lb1  dbdocs_lb2 }
Group dbdocs_pg       [name: 'DBDocs Postgres Main DBs']    { dbdocs_pg_master  dbdocs_pg_standby }
Group dbx_ai_orca     [name: 'dbx-ai-orca']                 { orca1  orca2 }
Group monitoring      [name: 'Monitoring system']           { grafana  loki  prometheus }

Group production [name: 'Production servers', style: dashed] {
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

Group private_net [name: 'Private network'] {
  production
  monitoring
  ossec
  deploy
}

// Metadata can land on something declared anywhere, including another file.
Metadata api1 {
  owner 'platform-team'
  runbook 'wiki/dbdiagram-api'
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
---

Project dbml_itself {
  diagram_type: 'architecture'
  Note: 'What happens to a file between being typed and being drawn'
}

// Not one of the thirty-one built-in words describes code, so every word here is declared.
// The vocabulary opening by seven is the vocabulary working; it is also the argument for
// shipping a second pack next to the devops one.
Kind Stage  [icon: chip,   color: '#3f6ea8']
Kind Shape  [icon: graph,  color: '#4a7c59']
Kind Words  [icon: tag]
Kind Closed [icon: lock,   color: '#8a5a2b']
Kind Author [icon: person]
Kind Canvas [icon: browser]
Kind Lib    [icon: nodejs]

Author author [name: 'Whoever writes the file']

// ── @dbml/parse: the front end both dialects share ────────────────────────────
// A NODE TAKES A NOTE THE SAME WAY A CONTAINER DOES: a body with a \`Note:\` in it. Nothing
// about the syntax changes because the box is smaller.
Stage lex [name: 'Lexer'] {
  Note: '''
  **642 lines, and not one DBML word in them.**

  It lexes identifiers, strings, numbers and punctuation. \`Table\` is
  an identifier to it, and so is \`Server\`.

  - \`allowFrontMatter\` is the one switch the dialect turns on here
  - \`---\` ... \`---\` comes back as a single trivia token, fences on
  '''
}

Stage parse [name: 'Parser'] {
  Note: '''
  **1623 lines with no mention of \`ElementKind\`.**

  One generic \`elementDeclaration()\` reads \`Keyword name [settings] { body }\`
  and does not care which keyword it was.

  - \`allowBodylessElement\` lets \`Server api1\` stand on its own
  - an architecture file is mostly bodyless; a DBML file is mostly bodies
  '''
}
Stage filegraph [name: 'File graph & cache'] {
  Note: '''
  **Borrowed whole, and not adapted.**

  \`use * from './packs/devops.arch'\` is DBML's own import, its own
  resolver and its own cache.

  - a specifier with no \`.dbml\` on it gets one appended
  - which is why the suffix is \`.arch.dbml\` and not \`.dbml.arch\`
  - the reverse misses, in every spelling
  '''
}
Shape tokens    [name: 'Tokens']
Shape ast       [name: 'Syntax tree']
Words dbmlwords [name: "DBML's 16 elements"]

// ── @dbml/arch: the architecture dialect ──────────────────────────────────────
Stage dialect [name: 'Three dialect switches'] {
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
Stage bind [name: 'Bind & interpret'] {
  Note: '''
  **Where this dialect stops borrowing.**

  DBML's 16 modules resolve names against a schema. An architecture
  file has no schema, so binding is written here instead.

  - \`read.ts\` is the only file that touches a syntax node
  - everything above it speaks in names, settings and ranges
  - 18 of 20 architecture constructs parse through DBML unchanged
  '''
}
Words archvocab [name: '31 kinds, 84 icon names'] {
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
Shape model [name: 'NetworkModel'] {
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
Closed measure [name: 'Measure boxes'] {
  Note: '''
  **Measured first, placed later.**

  That order is what makes the layout engine swappable: ELK, a grid,
  or a person dragging all take a box whose size is already settled
  by the text inside it.

  - a node is an icon and a caption, with no frame
  - a note is NOT measured; it has no box to take up room
  '''
}
Closed place [name: 'Place boxes'] {
  Note: '''
  **ELK places, with a grid behind it.**

  - \`elk.layered\`, containers as real nesting
  - saved overrides go on top: engine first, then the sidecar
  - only leaves are saved; a container's box is always re-derived
  '''
}
Closed route [name: 'Route lines'] {
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
Closed paint [name: 'Paint SVG'] {
  Note: '''
  **No canvas and no WebGL: the export is what is on screen.**

  Colours arrive as \`var()\` references, so the page's theme owns
  them and the same renderer sits in a playground, a docs page and
  a product that each think they own the palette.

  - dimming is a class, so a selection costs no geometry
  - the drawings live here; the NAMES live in the open repo
  '''
}
Lib    elk     [name: 'elkjs']

// ── the playground ────────────────────────────────────────────────────────────
Canvas editor [name: 'Monaco editor']
Canvas stores [name: 'Pinia stores'] {
  Note: '''
  **Two compilers, one editor.**

  - \`archStore\` compiles, and decides whether there IS a diagram
  - \`parserStore\` is the DBML side, suppressed on an architecture
    file so it does not report 154 problems about a language the
    document is not written in
  '''
}
Canvas pane   [name: 'Architecture pane']

// A container's note is markdown, and it is where the file listing lives. A triple-quoted
// string keeps its line breaks, so a list stays a list.
Group frontend [name: '@dbml/parse — open, vocabulary-neutral'] {
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

Group vocabulary_dbml [name: "DBML's own vocabulary"] {
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

Group archpkg [name: '@dbml/arch — open, the new language'] {
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

Group renderer [name: 'dbx-graph-renderer — closed, separate repository', style: dashed] {
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

Group playground [name: 'dbml-playground'] {
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
  reads 'read.ts, 137 lines'
  owns 'binding and interpretation, deliberately not shared with DBML'
}

Metadata archvocab {
  pairs_with 'the renderer icons.ts, asserted by a test on the closed side'
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
