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
