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
export const PACK_FILE = `// Elements shared between diagrams. A file that imports them can group and link them.

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
 * The same estate as one document, with the shared elements inline instead of imported.
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
