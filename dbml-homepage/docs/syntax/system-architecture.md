---
title: System Architecture
---

# System Architecture

**System Architecture** is the part of DBML that defines and documents the elements of a system and the connections between them. It allows you to model networks, infrastructure, service dependencies and deployment environments.

- [Elements](#elements)
  - [Element Settings](#element-settings)
  - [Element Icon](#element-icon)
  - [Role Precedence](#role-precedence)
- [Links](#links)
  - [Link Settings](#link-settings)
- [Groups](#groups)
  - [Group Settings](#group-settings)

**Example**

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

:::note
Every architecture file must start with `diagram_type: arch` in its [front matter](./enrichment-visualization.md#front-matter).
:::

## Elements

An **element** is one part of your system or something it connects to, such as a load balancer, a queue or a client.

```text
// syntax
Role name
Role name as alias [settings] { settings }
```

- `Role`: one of the 32 built-in [roles](./architecture-roles-and-types.mdx#roles), such as `Server` or `Database`. Roles are case-insensitive.
- `name`: the element's name, in double quotes if it contains spaces.
- (Optional) `as alias`: another name to refer to the element by. If an element has an alias, it must be referred to by the alias in `Link`, `Group`, `Metadata`, inline `link` and `use`.
- (Optional) `[settings]` or `{ settings }`: see [Element Settings](#element-settings).

**Example**

```text
// name only
Server api

// quoted name with an alias
Server "Orders API" as orders_api

// short form: settings on one line
Database users_db [type: 'postgres', color: #336791]

// long form: settings in a body, one per line
Database "Primary" as pg_primary {
  type: 'postgres'
  version: '16.3'
  Note: 'Takes all writes'
}
```

Names and aliases are case-sensitive. These rules also count elements imported from other files:

- Two elements with the same role and no alias cannot share a name.
- An alias must differ from every other alias, and from every name that has no alias.
- An element with an alias can have any name, even one another element uses.

### Element Settings

Write settings in `[ ]` on one line, or in `{ }` one per line. If a setting is in both, the one in `{ }` is used. Setting names of elements, links and groups are case-insensitive.

- `type`: which product the element is, such as `'postgres'`. See [Roles and Types](./architecture-roles-and-types.mdx#types).
- `icon`: an image URL starting with `https://` or `data:image/`. See [Element Icon](#element-icon).
- `color`: the icon's color, such as `#336791`. An `icon` image keeps its own colors.
- `style: dashed` or `inactive`: a dashed outline. `inactive` also marks the element as not in service.
- `Note`: see [Note Definition](./enrichment-visualization.md#note-definition).
- Any other key is a [custom property](./enrichment-visualization.md#custom-properties).

In a [Metadata block](./enrichment-visualization.md#metadata-block), a key that is a setting, such as `color`, changes that setting. The role before the name is optional (see [Role Precedence](#role-precedence)).

**Example**

```text
// with the role
Metadata Server api1 {
  owner: 'platform-team'    // a custom property
  color: #e6522c            // changes the icon's color
}

// without the role
Metadata api2 { owner: 'platform-team' }
```

### Element Icon

An element's icon is the first of these that applies:

1. `icon`, if it starts with `https://` or `data:image/`. Any other value is ignored.
2. The icon for its `type`, if the value is listed on [Roles and Types](./architecture-roles-and-types.mdx#types).
3. Its role's icon.

**Example**

```text
// the Database icon
Database reports_db

// the PostgreSQL icon
Database orders_db [type: 'postgres']

// the image at the URL, not the Airbyte icon
Pipeline etl [type: 'airbyte', icon: 'https://example.com/etl.png']
```

### Role Precedence

Elements with different roles can share a name, such as `Server api` and `Database api`, and a group or a [sticky note](./enrichment-visualization.md#sticky-notes) can share a name with an element. When a name is shared, write the role, `Group` or `Note` before it to pick the one you mean.

With only the name, DBML gives a warning and uses the first match in this order: the roles in the order they appear on [Roles and Types](./architecture-roles-and-types.mdx#roles), then `Group`, then `Note`. For example, `Server` comes before `Database`.

**Example**

```text
Server api
Database api

// with the role: refers to Database api
Link: client > Database api

// name only: refers to Server api, and gives a warning
Link: client > api
```

## Links

A link shows that one element or group talks to another.

```text
// short form
Link: end operator end [settings]

// inline form: in the settings of the left end
Role name [link: operator end]
```

- `end`: an element or a [group](#groups). If the name is shared, see [Role Precedence](#role-precedence).
- `operator`: which side opens the connection. Data can flow both ways over it.
  - `>`: the left side opens it, as in `api > db`.
  - `<`: the right side opens it, as in `db < api`.
  - `<>`: both sides open connections to each other, as in `billing <> orders`.
  - `-`: not specified, as in `api - sessions`.
- (Optional) `[settings]`: see [Link Settings](#link-settings).

You can write `Ref` instead of `Link`, and `ref` instead of `link`.

Linking the same two ends more than once gives a warning, whatever the operators.

**Example**

```text
// short form
Link: internet > cdn
Link: cdn > api [proto: HTTPS, host: 'api.example.com']

// inline form: same as Link: api > db and Link: api < queue
Server api [link: > db, ref: < queue]
```

### Link Settings

Write settings in `[ ]` after the second end. The inline form takes no settings.

- `proto`: the protocol, a word or a quoted string, such as `HTTPS`.
- `host`: the hostname the link reaches, a word or a quoted string.
- `color`: the line's color, such as `#f38020`.
- `style: dashed` and `inactive`: as for an element, with a dashed line instead of an outline.

## Groups

A group is a boundary around elements and other groups, such as an environment, a network or a cluster.

```text
// syntax
Group name as alias [settings] { member member }
```

- `name`: the group's name, as for an element. Two groups with no alias cannot share a name.
- (Optional) `as alias`: as for an element.
- (Optional) `[settings]`: see [Group Settings](#group-settings).
- `member`: an element or another group. Every member must be declared, in this file or in an imported one.
  - Write members on one line separated by spaces, or one per line.
  - On its own line, a member can start with its role, as in `Database orders`.
  - If several groups in a file list the same member, it belongs to the first one. The others ignore it, with no warning.

A link can end on a group. It then reaches the group as a whole, not one member. Linking a group to one of its direct members gives a warning.

**Example**

```text
// members on one line
Group "Orders cluster" as orders_cluster { api1 api2 }

// members one per line, one of them with its role
Group "Production" as production [color: #2e7d32] {
  orders_cluster
  Database orders
  cache
}

// a link that ends on a group
Link: client > orders_cluster
```

### Group Settings

Write settings in `[ ]`, or as `key: value` lines in `{ }`. In `{ }`, a single word is always a member: write `inactive` and `stacked` in `[ ]`.

- `color`: the group's color, such as `#2e7d32`.
- `style: dashed`, `inactive`, `Note` and custom properties: as for an element, with a dashed border instead of an outline.
- `label: bottom`: puts the group's name at the bottom.
- `stacked`: marks the group as horizontally scalable, such as a service that runs on several servers behind a load balancer.

A `Metadata` block works as for an element, with `Group` before the name.

**Example**

```text
Metadata Group production { color: #2e7d32 }
```

:::note
- An architecture file cannot define tables. It can import tables from a schema file, but its links and groups cannot refer to them.
- A schema file can import elements from an architecture file, but it cannot link or group them.
- In a [selective import](./module-system.md#selective-import), start each element with its role and each group with `Group`, as in `use { Monitoring grafana }` and `use { Group monitoring }`.
:::

:::tip
If an imported element has the same role and name as one in the importing file, rename it on import with `as`, as described in [Import Aliases](./module-system.md#import-aliases):

```text
use { Monitoring grafana as shared_grafana } from './monitoring'
```
:::
