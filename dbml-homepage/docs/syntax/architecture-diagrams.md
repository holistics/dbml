---
title: Architecture Diagrams
---

# Architecture Diagrams

In addition to database schemas, DBML can describe your infrastructure: the services you run, what
kind of service each one is, and how they connect to each other. Use an architecture diagram as a
blueprint for a system you are planning, or as documentation of one that already runs.

- [Your First Diagram](#your-first-diagram)
- [Front Matter](#front-matter)
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

## Your First Diagram

```text
---
diagram_type: arch
---

Internet internet
Server api
Database "Main database" as db [type: 'postgres']

Group "Production" as production { api db }

Link: internet > api
Link: api > db
```

![The internet links to the api server, which links to the Main database. The api server and the Main database are in the Production group.](/img/arch-first-diagram.png)

To create an architecture diagram, set `diagram_type: arch` in the front matter, or declare at least
one node or group, such as `Server api`. See [Front Matter](#front-matter).

Examples on this page show only the lines that matter. The nodes and groups they refer to are
assumed to be declared.

## Front Matter

Front matter is a block of `key: value` lines between two `---` lines. It must be the first thing
in the file.

```text
---
diagram_type: arch
direction: down
---
```

| Key | Value | Effect |
|---|---|---|
| `diagram_type` | `arch` or `architecture`, in any case | Makes the file an architecture diagram. Any other value makes it a schema |
| `direction` | `right` (default) or `down`, in lowercase | Links run left to right, or top to bottom, when the diagram is laid out automatically, such as with Auto Arrange. Any other value means `right` |

Values can be written with or without quotes. You can add other keys of your own; they do not
change the diagram.

Importing a file does not change the diagram type of the file that imports it.

A [`Project`](../docs.md#project-definition) block describes the diagram as a whole, as in a
schema. It can have a name, a `Note` and keys of your own:

```text
Project shop {
  owner: 'platform-team'
  Note: 'Shop infrastructure'
}
```

- Each value is a quoted string.
- A `Project` has no alias and no settings in square brackets.
- Its `Note` is not drawn on the diagram.
- Writing `diagram_type` inside `Project` is an error: it belongs in the front matter.

## Node Definition

A node is one box on the diagram, such as a server, a database or a queue.

```text
Role name
Role "name" as alias [settings] {
  body
}
```

- `Role`: the node's **role**, a keyword that describes what the node is, such as `Server` or
  `Database`. See [Built-in Roles](#built-in-roles).
- `name`: the node's name. If it has spaces or other special characters, write it in double quotes.
- (Optional) `as alias`: a short name that links, groups and `Metadata` use to refer to the node.
- (Optional) `[settings]`: settings on one line. See [Node Settings](#node-settings).
- (Optional) `{ body }`: settings, custom properties and a note, one per line.

For example:

```text
Server api
Server "DBDocs API Servers" as dbdocs_api
Database "Master" as pg_master {
  type: 'postgres'
  version: '16.3'
  Note: 'Primary, takes all writes'
}
```

Links, groups and [`Metadata`](#metadata-definition) refer to a node by its alias, or by its name
when it has no alias. When a node has an alias, the name is only a display label. Changing it does
not affect any links, groups or `Metadata`, and several nodes can have the same label.

When a node has a quoted name and no alias, include the quotes:

```text
Server "API 1"
Link: b > "API 1"
```

When you rename a node on the diagram and the node has no alias, the editor updates every link,
group and `Metadata` that refers to it in the same file.

Names and aliases are case-sensitive: `api` and `API` are different. They must be unique as
follows, counting nodes imported from other files:

- Nodes with different roles can use the same name. For example, `Server api` and `Database api`
  can both exist in one diagram.
- Two nodes with the same role and no alias cannot use the same name.
- An alias must be unique. It cannot be the same as another alias, or as the name of any node,
  group or sticky note that has no alias, whatever its role.

## Built-in Roles

DBML has 32 built-in roles, and custom roles are not supported. Starting a node with any other word
is an error. The editor suggests the closest roles, or lists all of them when none is close. Roles
are case-insensitive: `server api` is the same as `Server api`.

Each role belongs to a category, shown in the table below. A node's category sets the default color
of its icon (see [Node Icon](#node-icon)). Every role's icon is shown on
[Roles and Types](./architecture-roles-and-types.mdx#roles).

| Category | Roles |
|---|---|
| compute | `Server` `Function` `Container` `Service` `Registry` |
| data | `Database` `Cache` `Queue` `Topic` `Storage` `Bucket` `Warehouse` `Search` |
| network | `LoadBalancer` `Proxy` `VPN` `Gateway` `Firewall` `Router` `Secret` `DNS` |
| edge | `CDN` `Internet` |
| people | `Client` `Browser` `Mobile` `Team` |
| operations | `Monitoring` `Logging` `Alerting` `Scheduler` `Pipeline` |

## Node Settings

Settings set a node's icon, color, outline and note. You can write them in square brackets after
the name, or in the body, one per line. The two forms are equivalent:

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
| `type` | One of the [supported types](./architecture-roles-and-types.mdx#types), such as `'postgres'` | Shows the icon for that type |
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
2. The icon for the `type` setting, if its value is one of the
   [supported types](./architecture-roles-and-types.mdx#types).
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

A group is a boundary around parts of your system, such as an environment, a network or a cluster.
It is drawn as a box around its members.

```text
Group name { member member }
Group "name" as alias [settings] {
  member
  Role member
}
```

- `name`: the group's name, written as for a node.
- (Optional) `as alias`: a short name to refer to the group, as for a node.
- (Optional) `[settings]`: settings on one line. See [Group Settings](#group-settings).
- `member`: a node, group or sticky note, by name or alias. On the line of `{`, members are
  separated by spaces and cannot include a role. On a line of its own, a member can start with
  its role: a node's role, `Group` or `Note`.

For example:

```text
Group "dbdiagram API servers" as dbdiagram_api { api1 api2 }

Group backend {
  Server api
  Group api
  sessions
}
```

Add the role when several nodes, groups or sticky notes share the name. A group can use the same
name as a node, as described in [Role Precedence](#role-precedence).

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

A link shows that one part of your system talks to another. It is drawn as a
line between two nodes, groups or sticky notes.

```text
Link: end operator end [settings]
```

- `end`: a node, group or sticky note, by name or alias. It can start with its role: a node's
  role, `Group` or `Note`. Add the role when several nodes, groups or sticky notes share the name.
  A dotted end such as `api.web` is an error.
- `operator`: `>`, `<`, `<>` or `-`. See the table below.
- (Optional) `[settings]`: settings on one line. See [Link Settings](#link-settings).

The arrow points from the side that opens the connection to the side that answers. Data can flow in
both directions over a connection.

| Operator | Meaning |
|---|---|
| `>` | The left side opens the connection; the right side answers |
| `<` | The right side opens the connection; the left side answers |
| `<>` | Each side opens its own connections to the other |
| `-` | Which side opens the connection is not specified |

`>` and `<` draw one arrowhead, `<>` draws one at each end, and `-` draws none.

For example:

```text
Link: api > db                                   // the API reads from and writes to the database
Link: standby > primary [proto: replication]     // the standby connects to the primary and pulls its changes
Link: browser > ws [proto: WebSocket]            // the browser opens the connection; messages go both ways
Link: billing <> orders                          // Orders calls Billing to charge; Billing calls Orders back with a webhook
Link: client > Group api                         // the end is the group api, not a node named api
```

As in a schema, you can write `Ref:` instead of `Link:`. `Ref: api > db` draws the same line.

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
links.

```text
Note name [settings] {
  'text'
}
```

- `name`: the sticky note's name.
- (Optional) `[settings]`: `color`, inline links and custom properties.
- `'text'`: the note's text. A sticky note must have it.

For example:

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
refer to a specific one, write its role before its name: a node's role, `Group` or `Note`, as in `Server api`, `Group api` or `Note api`. If you write only the name and
several of them share it, the first match in the following order is used, and the editor shows a
warning: the roles in the order of the [Built-in Roles](#built-in-roles) table, then `Group`, then
`Note`.

## Metadata Definition

A `Metadata` block sets properties on a node, a group or a sticky note that is already declared,
including one declared in another file. It works the same way as
[Metadata blocks](./enrichment-visualization.md#metadata-block) in a schema.

```text
Metadata Role name {
  key: value
}
```

- (Optional) `Role`: the target's role: a node's role, `Group` or `Note`. Without it,
  DBML follows the [role precedence](#role-precedence) and the editor warns when several nodes,
  groups or sticky notes share the name.
- `name`: the target's name or alias. For a quoted name, include the quotes, as in
  `Metadata "API 1" { ... }`.
- `key: value`: one per line.

For example:

```text
Metadata Server api1 {
  owner: 'platform-team'
  runbook: 'wiki/dbdiagram-api'
}
```

A line whose key is a setting of the target, such as `color` or `type` on a node, changes that
setting as if it were written on the target itself. Any other line adds a custom property.

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

To import only some of them, list each one with its role: a node's role, `Group` or `Note`:

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

An architecture file can also import a schema file. The architecture file's links and groups can
refer to nodes, but not to the schema's tables: referring to a table is an error.

## Syntax Consistency

Architecture diagrams use the same punctuation as the rest of DBML:

- three dashes `---` (at the top of the file): the front matter block
- curly brackets `{}`: a body, which holds settings, custom properties, a note, group members, or a
  sticky note's text
- square brackets `[]`: settings on one line
- forward slashes `//`: comments
- single quotes (example: `'string'`): a string value
- double quotes (example: `"Display Name"`): the name shown on the diagram
- triple quotes (example: `'''multi-line string'''`): a multi-line string value
- hash `#` (example: `#336791`): a color
