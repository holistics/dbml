---
title: Architecture Diagrams
---

# Architecture Diagrams

DBML draws infrastructure as well as schemas. An architecture file describes what runs in your
estate, what each thing is, and what talks to what.

A file becomes an architecture file through its front matter:

```text
---
diagram_type: arch
---
```

- [Element Definition](#element-definition)
- [Element Settings](#element-settings)
- [Built-in Roles](#built-in-roles)
- [Custom Roles](#custom-roles)
- [Group Definition](#group-definition)
- [Link Definition](#link-definition)
- [Note Definition](#note-definition)
- [Metadata Definition](#metadata-definition)
- [Project Definition](#project-definition)
- [Modules](#modules)
- [Syntax Consistency](#syntax-consistency)

## Element Definition

An element is one box on the canvas. It opens with a **role**: the keyword that says what the
thing does, the way `Table` does in a schema.

```text
Server api
```

Give it a drawn name in double quotes, and a handle to refer to it by with `as`:

```text
Server "DBDocs API Servers" as dbdocs_api
```

The name is what the canvas shows. The handle is what links, groups and metadata use. With no
`as`, the name is the handle.

Properties go in a body, one per line:

```text
Database "Master" as pg_master {
  type: 'postgres'
  version: '16.3'
  Note: 'Primary, takes all writes'
}
```

Any key you write is kept and shown in the inspector. `type`, `icon`, `color`, `glyph` and
`Note` have meaning to the renderer; everything else is yours.

## Element Settings

A **brand** is a setting, not a keyword. The role says what the thing does, `type` says which
product it is:

```text
Database users_db [type: 'postgres']
Cache sessions   [type: 'redis']
Proxy edge       [type: 'nginx']
```

`type` draws that company's mark in that company's colour. For a product the icon pack does not
carry, point at a picture instead:

```text
Pipeline "Airbyte ETL" as airbyte [type: 'https://example.com/airbyte.png']
```

| Setting | Value | What it does |
|---|---|---|
| `type` | brand name, or an image URL | draws the product's mark, in its own colour |
| `icon` | icon name | draws a plain mark, when the thing has no brand |
| `color` | `'#rrggbb'` | overrules the colour the role or brand would use |
| `glyph` | `'M...'` | your own SVG path, for a mark nothing else has |
| `style: dashed` | — | draws the box dashed |
| `inactive` | — | same as `style: dashed`; marks something not in service |

Settings may be written in square brackets on one line, or in a body, whichever reads better:

```text
Database users_db [type: 'postgres', color: '#336791']

Database orders_db {
  type: 'postgres'
  color: '#336791'
}
```

## Built-in Roles

31 roles ship with the language.

| Category | Roles |
|---|---|
| compute | `Server` `Function` `Container` `Service` `Registry` |
| data | `Database` `Cache` `Queue` `Topic` `Storage` `Bucket` `Warehouse` `Search` |
| network | `LoadBalancer` `Proxy` `VPN` `Gateway` `Firewall` `Router` `Secret` |
| edge | `CDN` `Internet` |
| people | `Client` `Browser` `Mobile` `Team` |
| operations | `Monitoring` `Logging` `Alerting` `Scheduler` `Pipeline` |

## Custom Roles

`Kind` names a role the built-ins do not have, or overrules one they do.

```text
// a role the built-ins lack
Kind Lakehouse [icon: graph, color: '#4a7c59']

// a house style for a role that already exists
Kind Firewall [icon: firewall, color: '#c0453a']

Lakehouse "Iceberg on S3" as lake
```

A brand needs no `Kind`. `Kind` is for roles.

## Group Definition

A group draws a container around the things it lists. It lists **handles**, one per line or
separated by spaces.

```text
Group "dbdiagram API servers" as dbdiagram_api { api1 api2 }
```

A group may list another group, so nesting needs no new syntax:

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

## Link Definition

A link is a line between two handles. Four operators:

| Operator | Meaning |
|---|---|
| `>` | one way, left to right |
| `<` | one way, right to left |
| `<>` | both ways |
| `-` | no direction |

```text
Link: internet > cloudflare
Link: cloudflare > api  [proto: HTTPS, host: 'api.dbdiagram.com']
Link: api - sessions
```

`proto` and `host` describe the conversation, so they live on the line rather than inside a box:
the same server answers on more than one of them.

A link may end on a group. The API talks to the replica set, not to whichever member happens to
be primary today:

```text
Link: dbdiagram_api > mongo_rs
```

**Inline links.** A link can also be written on the element it leaves, with `link` or `ref`:

```text
Server api [link: > db, link: < queue, ref: <> cache]
```

## Note Definition

A note is text on the canvas. It is an element like any other, so it can join a group and take a
link:

```text
Note do_lbs { 'DigitalOcean Load Balancers' }

Note memo [link: - api] { 'Scheduled for retirement' }
```

To attach a note to an element rather than place one of its own, use `Note` inside its body:

```text
Server "Shop API" as api {
  Note: 'Serves the storefront'
}
```

## Metadata Definition

`Metadata` adds free-form fields to something already declared, including something declared in
another file.

```text
Metadata api1 {
  owner: 'platform-team'
  runbook: 'wiki/dbdiagram-api'
}
```

Fields must be written as `key: value`. They are not drawn; they show in the inspector and
travel with the model.

## Project Definition

As in a schema, `Project` names the whole thing.

```text
Project dbx {
  Note: 'The DBX production estate'
}
```

Front matter above it carries anything else you want to record:

```text
---
title: DBX network diagram
owner: platform-team
updated: 2026-10-12
diagram_type: arch
---
```

## Modules

A **pack** is a file of vocabulary: the roles your house uses. Import it like any other module.

```text
use * from './packs/devops.arch'
```

Ship one per cloud, per team, or per house style, and every diagram that imports it draws the
same way.

## Syntax Consistency

The architecture dialect uses the same punctuation as the rest of DBML.

- curly brackets `{}`: a body, for properties and for group members
- square brackets `[]`: settings on one line
- forward slashes `//`: comments
- single quote as `'string'`: string value
- double quote as `"Drawn Name"`: the name shown on the canvas
- triple quote as `'''multi-line string'''`: multi-line string value
- `as handle`: the name everything else refers to
