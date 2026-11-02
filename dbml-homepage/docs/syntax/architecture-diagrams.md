---
title: Architecture Diagrams
---

# Architecture Diagrams

In addition to database schemas, DBML can describe your infrastructure: the services you run, what
kind of service each one is, and how they connect to each other.

```text
Project dbx {
  diagram_type: 'arch'
}

Internet internet
Server api
Database "Main database" as db [type: 'postgres']

Group "Production" as production { api db }

Link: internet > api
Link: api > db
```

To create an architecture diagram, set `diagram_type: 'arch'` in `Project`, or declare at least one
node or group, such as `Server api`. See [Project Definition](#project-definition).

Examples on this page show only the lines that matter. The nodes and groups they refer to are
assumed to be declared.

- [Project Definition](#project-definition)
- [Node Definition](#node-definition)
- [Built-in Roles](#built-in-roles)
- [Node Settings](#node-settings)
  - [Node Icon](#node-icon)
- [Group Definition](#group-definition)
  - [Group Settings](#group-settings)
- [Link Definition](#link-definition)
  - [Link Settings](#link-settings)
  - [Links to a Group](#links-to-a-group)
  - [Inline Links](#inline-links)
- [Notes](#notes)
- [Role Precedence](#role-precedence)
- [Metadata Definition](#metadata-definition)
- [Modules](#modules)
  - [Tables and Nodes in One Diagram](#tables-and-nodes-in-one-diagram)
- [Syntax Consistency](#syntax-consistency)
- [Supported Types](#supported-types)

## Project Definition

`Project` describes the diagram as a whole. In an architecture diagram, it also sets the diagram
type and the layout direction:

```text
Project dbx {
  diagram_type: 'arch'
  direction: 'down'
  Note: 'The DBX production infrastructure'
  owner: 'platform-team'
}
```

| Key | Value | Effect |
|---|---|---|
| `diagram_type` | `'arch'`, `'architecture'` or `'dbml'` | `'arch'` and `'architecture'` make an architecture diagram, and `'dbml'` or any other value makes a schema |
| `direction` | `'right'` (default) or `'down'` | Links run left to right, or top to bottom. It applies when the diagram is laid out automatically, such as with Auto Arrange |
| `Note` | String | A description of the whole diagram. It is not drawn on the diagram |
| `database_type` | String | Accepted, as in a schema, but has no effect in an architecture diagram |

Importing a file does not change the diagram type of the file that imports it.

The project name is optional: `Project { ... }` is also valid. Values must be quoted strings. Any
other `key: 'value'` line is accepted and does not change the drawing. A `Project` cannot have an
alias or a list of settings in square brackets.

## Node Definition

A node is one box on the diagram. Each node starts with a **role**, a keyword that describes what the
node is, followed by the node's name.

```text
Server api
```

Links, groups and [`Metadata`](#metadata-definition) refer to a node by its name. If the name has
spaces or other special characters, write it in double quotes. You can also give the node a short
**alias** with `as`:

```text
Server "DBDocs API Servers" as dbdocs_api
```

When a node has an alias, refer to it by the alias. The name is then only a display label.
Changing it does not affect any links, groups or `Metadata`, and several nodes can have the same
label.

When a node has no alias, refer to it by its name. If the name is quoted, include the quotes:

```text
Server "API 1"
Link: b > "API 1"
```

When you rename a node on the diagram and the node has no alias, the editor updates every link,
group and `Metadata` that refers to it in the same file.

Nodes with different roles can use the same name. For example, `Server api` and `Database api` can
both exist in one diagram. Two nodes with the same role and no alias cannot use the same name,
including nodes imported from other files. An alias cannot be the same as another alias, or as the
name of a node, group or sticky note that has no alias, whatever the role. Names and aliases are
case-sensitive: `api` and `API` are different.

A node can have a body. Each line of the body holds one [setting](#node-settings),
[custom property](#node-settings) or [note](#notes):

```text
Database "Master" as pg_master {
  type: 'postgres'
  version: '16.3'
  Note: 'Primary, takes all writes'
}
```

## Built-in Roles

DBML has 32 built-in roles, and custom roles are not supported. Starting a node with any other word
is an error. The editor suggests the closest roles, or lists all of them when none is close. Roles
are case-insensitive: `server api` is the same as `Server api`.

Each role belongs to a category, shown in the table below. A node's category sets the default color
of its icon (see [Node Icon](#node-icon)).

| Category | Roles |
|---|---|
| compute | `Server` `Function` `Container` `Service` `Registry` |
| data | `Database` `Cache` `Queue` `Topic` `Storage` `Bucket` `Warehouse` `Search` |
| network | `LoadBalancer` `Proxy` `VPN` `Gateway` `Firewall` `Router` `Secret` `DNS` |
| edge | `CDN` `Internet` |
| people | `Client` `Browser` `Mobile` `Team` |
| operations | `Monitoring` `Logging` `Alerting` `Scheduler` `Pipeline` |

## Node Settings

Settings change how a node looks. You can write them in square brackets after the name, or in
the body, one per line. The two forms are equivalent:

```text
Database users_db [type: 'postgres', color: #336791]

Database orders_db {
  type: 'postgres'
  color: #336791
}
```

If the same setting appears in both places, the one in the body is used. Setting names are
case-insensitive: `Color` and `color` are the same setting.

| Setting | Value | Effect |
|---|---|---|
| `type` | One of the [supported types](#supported-types), such as `'postgres'` | Shows the icon for that type |
| `icon` | Image URL: `'https://...'` or `'data:image/...'` | Shows that image as the node's icon |
| `color` | Color: `#rgb` or `#rrggbb` | Changes the icon's color |
| `style: dashed` | | Draws the node with a dashed outline |
| `inactive` | | Same as `style: dashed`; marks a node that is not in service |
| `Note` | String | Adds a note to the node. See [Notes](#notes) |

You can also add keys of your own, such as `version`, `owner` or `region`. These keys are
[custom properties](./enrichment-visualization.md#custom-properties). They are not drawn on the
diagram. A custom property's value is a quoted string, a number, `true` or `false`, or a color.

### Node Icon

Every node shows an icon above its name. The icon is chosen in this order:

1. The `icon` setting, if it is an image URL starting with `https://` or `data:image/`. Any other
   value is ignored.
2. The icon for the `type` setting, if its value is one of the [supported types](#supported-types).
3. The role's default icon. Every role has one.

```text
Database users_db                                   // uses the default Database icon
Database orders_db [type: 'postgres']               // uses the PostgreSQL icon
Pipeline "Airbyte ETL" as airbyte [
  type: 'airbyte',
  icon: 'https://example.com/airbyte.png'           // uses the image at this URL instead of the Airbyte icon
]
```

Default icons and the icons shown for `type` are drawn in one color. That color depends on the
role's [category](#built-in-roles), unless you set `color`. An image set with `icon` keeps its
original colors.

## Group Definition

A group is a box drawn around its members. Like a node, a group has a name and can have an alias
with `as`. A group can use the same name as a node, as described in
[Role Precedence](#role-precedence). List the members by name or alias, one per line or separated by
spaces:

```text
Group "dbdiagram API servers" as dbdiagram_api { api1 api2 }
```

Members written on the same line as `{` cannot include a role. A member on its own line can also
include its role (`Group` for a group, `Note` for a sticky note). Add the role when several nodes,
groups or sticky notes share the name:

```text
Group backend {
  Server api
  Group api
  sessions
}
```

Every member must be declared, either in the same file or in an imported file. Listing a name that
is not declared anywhere is an error.

A group can contain other groups. To nest a group, list it as a member of another group:

```text
Group "Production servers" as production [style: dashed] {
  dbdiagram_api
  mongo_rs
  redis
}

Group "Private network" as private_net {
  production
  monitoring
}
```

A node, group or sticky note belongs to one group only. Listing it in a second group has no effect.

### Group Settings

Write group settings in square brackets after the name, or as `key: value` lines in the body:

```text
Group "Legacy" as legacy [color: #9e9e9e, style: dashed, label: bottom] { old_api old_db }
```

If the same setting appears in both places, the one in the body is used.

| Setting | Value | Effect |
|---|---|---|
| `color` | Color: `#rgb` or `#rrggbb` | Fills the group with a light shade of that color |
| `style: dashed` | | Draws the border dashed |
| `inactive` | | Same as `style: dashed` |
| `label: bottom` | | Shows the group's name at the bottom left of the group instead of the top left |
| `Note` | String | Adds a note to the group. See [Notes](#notes) |

In a group's body, a single word is always read as a member, even when it is a setting name such as
`inactive`. A `key: value` line is read as a setting if the key is a setting name, and as a custom
property otherwise.

## Link Definition

A link draws a line between two nodes, groups or sticky notes. The arrow points from the side that
opens the connection to the side that answers. Data can flow in both directions over a connection.
To describe the connection, use the [link settings](#link-settings).

| Operator | Meaning |
|---|---|
| `>` | The left side opens the connection; the right side answers |
| `<` | The right side opens the connection; the left side answers |
| `<>` | Each side opens its own connections to the other |
| `-` | Which side opens the connection is not specified |

`>` and `<` draw one arrowhead, `<>` draws one at each end, and `-` draws none.

```text
Link: api > db                                   // the API reads from and writes to the database
Link: standby > primary [proto: replication]     // the standby connects to the primary and pulls its changes
Link: browser > ws [proto: WebSocket]            // the browser opens the connection; messages go both ways
Link: billing <> orders                          // Orders calls Billing to charge; Billing calls Orders back with a webhook
```

As in a schema, you can write `Ref:` instead of `Link:`. `Ref: api > db` draws the same line.

Each end of a link can also include its role (`Group` for a group, `Note` for a sticky note). Add the
role when several nodes, groups or sticky notes share the name:

```text
Link: client > Group api
```

Each end must be a name or an alias, optionally preceded by its role. An end written as `api.web` is
an error.

### Link Settings

Write link settings in square brackets after the second end:

```text
Link: cloudflare > api [proto: HTTPS, host: 'api.dbdiagram.com', color: #f38020]
```

| Setting | Value | Effect |
|---|---|---|
| `proto` | Word, or text in single quotes, such as `HTTPS` | Shown as the first line of the link's label |
| `host` | Word, or text in single quotes, such as `'api.dbdiagram.com'` | Shown below `proto` in the link's label, or alone when there is no `proto` |
| `color` | Color: `#rgb` or `#rrggbb` | Colors the line and its arrowheads |
| `style: dashed` | | Draws the line dashed |
| `inactive` | | Same as `style: dashed` |

You can also write the settings before the colon: `Link [color: #f38020]: cloudflare > api`. Write
them in one place only: settings in both places are an error.

### Links to a Group

A link can end on a group. The link connects to the group as a whole, but not to each member. When
the individual members matter, draw links to them directly.

```text
Group "Mongo replica set" as mongo_rs { mongo1 mongo2 mongo3 }
Link: dbdiagram_api > mongo_rs     // the API talks to the replica set, but not to a specific member

Group "Private network" as private_net { api mongo_rs redis }
Link: internet > private_net       // traffic enters the network; the link does not say which members the traffic reaches
```

### Inline Links

You can also write a link in the square brackets of one of its ends, using `link` or `ref`. That end
is the left side of the operator:

```text
Server api [link: > db, link: < queue, ref: <> cache, link: > Group backend]
```

An inline link has no settings of its own: the other settings in the same brackets apply to the
node, group or sticky note itself. To give a link settings, write it as a `Link:` line instead. If
you write the same link both inline and as a `Link:` line, both are kept and the editor warns about
the duplicate.

## Notes

A [sticky note](./enrichment-visualization.md#sticky-notes) is a note with its own box on the
diagram. In an architecture diagram, a sticky note can also belong to a group and be connected by
links:

```text
Note do_lbs { 'DigitalOcean Load Balancers' }

Note memo [link: - api, color: #fff3b0] { 'Scheduled for retirement' }
```

A sticky note's `color` takes a color, such as `#fff3b0`, or `none` for a transparent background.
Any other setting on a sticky note, except an inline link, is a custom property. A sticky note can
use the same name as a node or a group, as described in [Role Precedence](#role-precedence).

To add a note to a node or a group instead, write `Note` in its body or in its square brackets:

```text
Server "Shop API" as api {
  Note: 'Serves the storefront'
}

Server "Admin API" as admin [note: 'Internal only']
```

If both are written, the note in the body is used. A node or group with a note shows a note icon
next to its name. Hover over the icon to read the note.

## Role Precedence

A [group](#group-definition) or a [sticky note](#notes) can also use the same name as a node. To
refer to a specific one, you can write its role (`Group` for a group, `Note` for a sticky note)
before its name, as in `Server api`, `Group api` or `Note api`. If you write only the name and
several of them share it, the first match in the following order is used, and the editor shows a
warning: the roles in the order of the [Built-in Roles](#built-in-roles) table, then `Group`, then
`Note`.

## Metadata Definition

A `Metadata` block sets properties on a node, a group or a sticky note that is already declared,
including one declared in another file. It works the same way as
[Metadata blocks](./enrichment-visualization.md#metadata-block) in a schema:

```text
Metadata api1 {
  owner: 'platform-team'
  runbook: 'wiki/dbdiagram-api'
}
```

You can put the role (`Group` for a group, `Note` for a sticky note) before the name, as in
`Metadata Server api1 { ... }`, to identify the target. Without a role, DBML follows the
[role precedence](#role-precedence) and the editor warns when several nodes, groups or sticky notes
share the name. To target one with a quoted name, include the quotes, as in
`Metadata "API 1" { ... }`.

Each line must be written as `key: value`. A line whose key is a setting of the target, such as
`color` or `type` on a node, changes that setting as if it were written on the target itself.
Any other line adds a custom property.

```text
Metadata grafana {
  color: #e6522c        // changes the icon's color
  owner: 'platform'     // a custom property
}
```

A value set in a `Metadata` block takes precedence over the same key written on the target itself.
When several `Metadata` blocks set the same key, the value used follows
[Property Precedence](./enrichment-visualization.md#property-precedence): blocks in the current file
take precedence over blocks in imported files, a file imported later takes precedence over one
imported earlier, and within a file, a later block takes precedence over an earlier one.

## Modules

Nodes, groups and sticky notes can be defined in their own file and imported like any other DBML
module. The importing diagram can then group them and link to them.

```text
// monitoring.dbml
Monitoring "Grafana" as grafana [type: 'grafana']
Monitoring "Prometheus" as prometheus [type: 'prometheus']
```

```text
// main.dbml
use * from './monitoring'

Group "Monitoring system" as monitoring { grafana prometheus }
Link: prometheus > grafana
```

To import only some of them, list each one with its role (`Group` for a group, `Note` for a sticky
note):

```text
use {
  Monitoring grafana
} from './monitoring'
```

Use `as` to import a node under another name. In the importing file, the node is referred to only by
that name, and the diagram still shows the name it has in its own file. A local node can then use
the original name:

```text
use { Monitoring grafana as grafana_shared } from './monitoring'
Monitoring grafana
Link: grafana > grafana_shared
```

See [Module System](./module-system.md) for more about imports.

### Tables and Nodes in One Diagram

A schema file can import nodes from an architecture file. They are drawn alongside the schema's
tables:

```text
// schema.dbml
use * from './infrastructure'

Table users {
  id int
}
```

An architecture file can also import a schema file. Its links and groups can refer to nodes, but not
to tables: referring to a table is an error.

## Syntax Consistency

Architecture diagrams use the same punctuation as the rest of DBML:

- curly brackets `{}`: a body: settings, custom properties, a note, group members, or a sticky
  note's text
- square brackets `[]`: settings on one line
- forward slashes `//`: comments
- single quotes (example: `'string'`): a string value
- double quotes (example: `"Display Name"`): the name shown on the diagram
- triple quotes (example: `'''multi-line string'''`): a multi-line string value
- hash `#` (example: `#336791`): a color

## Supported Types

The `type` setting takes one of the values below. The values are case-insensitive: `'postgres'`,
`'Postgres'` and `'PostgreSQL'` all show the PostgreSQL icon. If the value is not on the list, the
node shows its role's default icon, and the editor shows a warning, with similar values when there
are any.

```text
aws gcp azure digitalocean hetzner vultr alibabacloud oracle heroku railway fly render
postgres mysql mariadb mongodb sqlite cockroachdb cassandra dynamodb neo4j influxdb clickhouse
couchbase planetscale supabase firebase duckdb rds spanner redis kafka rabbitmq nats sqs celery
pubsub elastic opensearch algolia meilisearch solr snowflake bigquery redshift databricks hive s3
minio gcs ceph nginx haproxy envoy traefik caddy cloudflare kong fastly akamai docker podman
kubernetes openshift containerd nomad consul istio lambda workers vercel netlify linux ubuntu
debian redhat alpine windows apple apache jfrog harbor grafana prometheus datadog newrelic sentry
opentelemetry splunk fluentd logstash pagerduty opsgenie slack discord jenkins githubactions gitlab
github circleci argo airflow dbt airbyte travisci teamcity buildkite temporal prefect terraform
vault onepassword hashicorp tailscale wireguard openvpn zerotier pfsense chrome firefox safari brave
android ios flutter nodejs python golang java rust ruby php dotnet elixir deno bun springboot
stripe
```

These alternative values are also accepted:

| Alternative values | Same as |
|---|---|
| `postgresql` `pg` `psql` | `postgres` |
| `k8s` `k9s` `k8sio` | `kubernetes` |
| `mongo` | `mongodb` |
| `elasticsearch` `es` | `elastic` |
| `mq` `amqp` | `rabbitmq` |
| `node` | `nodejs` |
| `go` | `golang` |
| `tf` | `terraform` |
| `otel` | `opentelemetry` |
| `gha` | `githubactions` |
| `1password` | `onepassword` |
| `do` | `digitalocean` |
| `google` `gcloud` | `gcp` |
| `amazon` `ec2` | `aws` |
