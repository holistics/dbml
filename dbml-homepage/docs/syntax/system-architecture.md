---
title: System Architecture
---

# System Architecture

DBML can also describe how your system is built. **Nodes** are the things in it, such as servers,
databases, the internet or a team. **Groups** are boundaries around them. **Links** show what talks
to what.

- [Example](#example)
- [Nodes](#nodes)
  - [Node Settings](#node-settings)
  - [Node Icon](#node-icon)
  - [Role Precedence](#role-precedence)
- [Links](#links)
  - [Link Settings](#link-settings)
  - [Inline Links](#inline-links)
- [Groups](#groups)
  - [Group Settings](#group-settings)

## Example

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

`diagram_type: arch` in the [front matter](./enrichment-visualization.md#front-matter) makes a file
an architecture file. An architecture file cannot define tables.
[Sticky notes](./enrichment-visualization.md#sticky-notes) and [imports](./module-system.md) work in
it too.

Examples below show only the lines that matter.

## Nodes

A node is one thing in your system, such as a server, a database or a team.

```text
// syntax
Role name
Role name as alias [settings] { settings }

// example
Server api
Server "Orders API" as orders_api
Database users_db [type: 'postgres', color: #336791]
Database "Primary" as pg_primary {
  type: 'postgres'
  version: '16.3'
  Note: 'Takes all writes'
}
```

- `Role`: what the node is, such as `Server`, `Database` or `Queue`. Roles are case-insensitive.
  You cannot make up your own role. See all 32 in
  [Roles and Types](./architecture-roles-and-types.mdx#roles).
- `name`: the node's name. As everywhere in DBML, a name with spaces or other special characters
  goes in double quotes.
- (Optional) `as alias`: the name that links, groups and `Metadata` use for the node. Without an
  alias, they use the name.
- (Optional) `[settings]` or `{ settings }`: see [Node Settings](#node-settings).

Names and aliases are case-sensitive. Two nodes with the same role and no alias cannot share a
name. An alias cannot be the same as another alias, or as the name of a node, group or sticky note
that has no alias.

With an alias, the name is for people reading the file. It can be any text, even another node's
name.

In a selective import, write the role before the name, as in
`use { Monitoring grafana } from './monitoring'`.

### Node Settings

Write settings in `[ ]` on one line, or in `{ }` one per line. If a setting is in both, the one in
`{ }` is used. Setting names are case-insensitive.

- `type`: which product the node is, such as `'postgres'`. See
  [Roles and Types](./architecture-roles-and-types.mdx#types). An unknown type is a warning: the
  file is still valid.
- `icon`: an image URL starting with `https://` or `data:image/`. See [Node Icon](#node-icon).
- `color`: the icon's color, such as `#336791`. An `icon` image keeps its own colors.
- `style: dashed`: a dashed outline.
- `inactive`: marks something not in service, with the same dashed outline.
- `Note`: text about the node.
- Any other `key: value` is a [custom property](./enrichment-visualization.md#custom-properties),
  such as `version: '16.3'`.

In a [Metadata block](./enrichment-visualization.md#metadata-block), a key that is a setting, such
as `color`, changes that setting. The role before the name is optional, as in a link (see
[Role Precedence](#role-precedence)).

```text
Metadata Server api1 {
  owner: 'platform-team'
  color: #e6522c      // changes the icon's color
}

Metadata api2 { owner: 'platform-team' }    // no role
```

### Node Icon

A node's icon is the first of these that applies:

1. `icon`, if it starts with `https://` or `data:image/`. Any other value is ignored.
2. The icon for its `type`. An unknown type has no icon.
3. Its role's icon.

```text
// the Database icon
Database reports_db

// the PostgreSQL icon
Database orders_db [type: 'postgres']

// the image at the URL, not the Airbyte icon
Pipeline etl [type: 'airbyte', icon: 'https://example.com/etl.png']
```

### Role Precedence

Nodes with different roles can share a name, such as `Server api` and `Database api`. A group or a
[sticky note](./enrichment-visualization.md#sticky-notes) can also share a name with a node. To
refer to one of them, write its role, `Group` or `Note`, before the name.

```text
Server api
Database api

Link: client > Database api
Link: client > api            // warning: uses Server api
```

With only the name, DBML gives a warning and uses the first match in this order: the roles in the
order they appear on [Roles and Types](./architecture-roles-and-types.mdx#roles), then `Group`,
then `Note`. For example, `Server` comes before `Database`.

## Links

A link shows that one thing in your system talks to another.

```text
// syntax
Link: end operator end [settings]

// example
Link: internet > cdn
Link: cdn > api [proto: HTTPS, host: 'api.example.com']
Link: standby > primary [proto: replication]
Link: api - sessions
```

- `end`: a node or a [group](#groups), by alias or name. If the name is shared, see
  [Role Precedence](#role-precedence).
- `operator`: which side opens the connection. Data can flow both ways over it.
  - `>`: the left side opens it.
  - `<`: the right side opens it.
  - `<>`: both sides open connections to each other.
  - `-`: not specified.
- (Optional) `[settings]`: see [Link Settings](#link-settings).

You can write `Ref:` instead of `Link:`.

Linking the same two ends more than once is a warning, whatever the operators.

### Link Settings

Write settings in `[ ]` after the second end. Setting names are case-insensitive.

- `proto`: the protocol, a word or a quoted string, such as `HTTPS`.
- `host`: the hostname the link reaches, a word or a quoted string.
- `color`: the link's color.
- `style: dashed`: a dashed line.
- `inactive`: marks something not in service, with the same dashed line.

### Inline Links

A link can also go in the settings of one of its ends, with `link` or `ref`. That end is the left
side. An inline link takes no settings of its own.

```text
Server api [link: > db, ref: < queue]    // same as Link: api > db and Link: api < queue
```

## Groups

A group is a boundary around things in your system, such as an environment, a network or a
cluster.

```text
// syntax
Group name as alias [settings] { member member }

// example
Group "Orders cluster" as orders_cluster { api1 api2 }

Group "Production" as production [color: #2e7d32] {
  orders_cluster
  Database orders
  cache
}
```

- `name`: the group's name, as for a node. Two groups with no alias cannot share a name.
- (Optional) `as alias`: as for a node.
- (Optional) `[settings]`: see [Group Settings](#group-settings).
- `member`: a node or another group, by alias or name. Every member must be declared, in this file
  or in an imported one.
  - Write members on one line separated by spaces, or one per line.
  - On its own line, a member can start with its role, as in `Database orders`.
  - If several groups in a file list the same member, it belongs to the first one. The others
    ignore it, with no warning.

A link can end on a group. It then reaches the group as a whole, not one member:

```text
Link: client > orders_cluster
```

Linking a group to one of its direct members is a warning.

In a selective import, write `Group` before the name, as in
`use { Group monitoring } from './monitoring'`.

### Group Settings

Write settings in `[ ]`, or as `key: value` lines in `{ }`. Setting names are case-insensitive. In
`{ }`, a single word is always a member: write `inactive` in `[ ]`.

- `color`: the group's color.
- `style: dashed`: a dashed border.
- `inactive`: marks something not in service, with the same dashed border.
- `label: bottom`: puts the group's name at the bottom.
- `Note`: text about the group.
- Any other `key: value` is a [custom property](./enrichment-visualization.md#custom-properties).

As for a node, a `Metadata` key that is a setting changes that setting:

```text
Metadata Group production { color: #2e7d32 }
```
