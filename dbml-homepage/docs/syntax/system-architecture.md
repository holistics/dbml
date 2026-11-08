---
title: System Architecture
---

# System Architecture

**System Architecture** is the part of DBML that defines and documents the elements of a system and the connections between them. It allows you to model networks, infrastructure, service dependencies and deployment environments.

- [Elements](#elements)
  - [Element Settings](#element-settings)
  - [Element Icon](#element-icon)
  - [Referring to Elements](#referring-to-elements)
- [Links](#links)
  - [Link Settings](#link-settings)
- [Groups](#groups)
  - [Group Settings](#group-settings)
- [Notes](#notes)

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
<role> <name>
<role> <name> as <alias> [<settings>] { <settings> }
```

- `<role>`: one of the 39 built-in [roles](./architecture-roles-and-types.mdx#roles), such as `Server` or `Database`. Roles are case-insensitive.
- `<name>`: the element's name, in double quotes if it contains spaces.
- `as <alias>` (optional): another name to refer to the element by. If an element has an alias, it must be referred to by the alias in `Link`, `Group`, `Metadata`, inline `link` and `use`.
- `[<settings>]` or `{ <settings> }` (optional): see [Element Settings](#element-settings).

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

Names and aliases are case-sensitive. These rules also apply to elements imported from other files:

- Two elements with the same role and no alias cannot share a name.
- An alias must differ from every other alias, and from every name that has no alias.
- An element with an alias can have any name, even one another element uses.

### Element Settings

Write settings in `[ ]` on one line, or in `{ }` one per line. If a setting is in both, the one in `{ }` is used. Setting names of elements, links and groups are case-insensitive.

- `type`: which product the element is, such as `'postgres'`. See [Roles and Types](./architecture-roles-and-types.mdx#types).
- `icon` (optional): a custom image URL. See [Element Icon](#element-icon).
- `color`: the icon's color, such as `#336791`. An `icon` image keeps its own colors.
- `style: dashed`: a dashed outline.
- `Note`: see [Note Definition](./enrichment-visualization.md#note-definition).
- Any other key is a [custom property](./enrichment-visualization.md#custom-properties).

### Element Icon

Every role has a built-in icon, and many `type` values have their own. To use your own image instead, set `icon`.

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

// an inline image (shortened)
Server auth [icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmci...']
```

### Referring to Elements

Elements with different roles can share a name, such as `Server api` and `Database api`. With only the name, DBML uses the first match in this order: the roles in the order they appear on [Roles and Types](./architecture-roles-and-types.mdx#roles), then `Group`, then `Note`. For example, `Server` comes before `Database`. To make sure the right element is referred to, write its role before the name, such as `Database api` or `Group production`.

**Example**

```text
Server api
Database api

// with the role: refers to Database api
Link: client > Database api

// name only: refers to Server api
Link: client > api
```

## Links

A link shows a connection that one element or group makes to another.

```text
// on its own line
Link: <end> <operator> <end> [<settings>]

// inline: in the settings of the left end
<role> <name> [link: <operator> <end>]
```

- `<end>`: an element or a [group](#groups). If the name is shared, see [Referring to Elements](#referring-to-elements).
- `<operator>`: which side opens the connection. Data can flow both ways over it.
  - `>`: the left side opens it, as in `api > db`.
  - `<`: the right side opens it, as in `db < api`.
  - `<>`: both sides open connections to each other, as in `billing <> orders`.
  - `-`: not specified, as in `api - sessions`.
- `[<settings>]` (optional): see [Link Settings](#link-settings).

Linking the same two ends more than once gives a warning, whatever the operators.

**Example**

```text
// on its own line
Link: internet > cdn
Link: cdn > api [proto: HTTPS, host: 'api.example.com']

// inline: same as Link: api > db and Link: api < queue
Server api [link: > db, link: < queue]
```

### Link Settings

Write settings in `[ ]` after the second end. An inline link takes no settings.

- `proto`: the protocol, a word or a quoted string, such as `HTTPS`.
- `host`: the hostname the link reaches, a word or a quoted string.
- `color`: the line's color, such as `#f38020`.
- `style: dashed`: a dashed line.

## Groups

A group is a boundary around elements and other groups, such as an environment, a network or a cluster.

```text
// syntax
Group <name> as <alias> [<settings>] { <member> <member> }
```

- `<name>`: the group's name, as for an element. Two groups with no alias cannot share a name.
- `as <alias>` (optional): as for an element.
- `[<settings>]` (optional): see [Group Settings](#group-settings).
- `<member>`: an element or another group.

There are two ways to list members:

- All on one line, separated by spaces.
- One per line. A member on its own line can start with its role, as in `Database orders`.

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

Write settings in `[ ]`, or as `key: value` lines in `{ }`. In `{ }`, a single word is always a member: write `stacked` in `[ ]`.

- `color`: the group's color, such as `#2e7d32`.
- `style: dashed`: a dashed border.
- `Note` and custom properties: as for an element.
- `label: top` or `label: bottom`: puts the group's name at the top (the default) or at the bottom.
- `stacked`: draws the group as one card with two cards behind it, to show copies of the same service, such as servers behind a load balancer.

## Notes

Tables and architecture elements cannot be in the same file. An architecture file cannot define tables, and a schema file cannot define architecture elements.
