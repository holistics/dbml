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

With `as`, the name is only a label: nothing refers to it, so it can change without touching any
reference, and two boxes may show the same label. Without `as`, the name is the handle, and renaming
it on the canvas updates every link, group and metadata in the file that names it.

A quoted name with no `as` is written in double quotes wherever it is referred to:

```text
Server "API 1"
Link: b > "API 1"
```

Elements of different roles may share a handle: `Server api`, `Group api` and `Note api` can live in
one diagram. Two elements of the same role may not, imports included. An alias is unique among every
handle, whatever its role.

Properties go in a body, one per line:

```text
Database "Master" as pg_master {
  type: 'postgres'
  version: '16.3'
  Note: 'Primary, takes all writes'
}
```

Any key you write is kept and shown in the inspector. `type`, `color` and `Note` have meaning to
the renderer; everything else is yours.

## Element Settings

A **brand** is a setting, not a keyword. The role says what the thing does, `type` says which
product it is:

```text
Database users_db [type: 'postgres']
Cache sessions   [type: 'redis']
Proxy edge       [type: 'nginx']
```

`type` draws that company's mark in that company's colour. For a product with no built-in mark,
point at a picture instead:

```text
Pipeline "Airbyte ETL" as airbyte [type: 'https://example.com/airbyte.png']
```

| Setting | Value | What it does |
|---|---|---|
| `type` | brand name, or an image URL | draws the product's mark, in its own colour |
| `color` | `'#rrggbb'` | overrules the colour the role or brand would use |
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

32 roles ship with the language, and they are the only roles. A diagram maps one to one to
infrastructure code, so there are no custom roles. A word that is not a role is an error that
names the nearest roles.

| Category | Roles |
|---|---|
| compute | `Server` `Function` `Container` `Service` `Registry` |
| data | `Database` `Cache` `Queue` `Topic` `Storage` `Bucket` `Warehouse` `Search` |
| network | `LoadBalancer` `Proxy` `VPN` `Gateway` `Firewall` `Router` `Secret` `DNS` |
| edge | `CDN` `Internet` |
| people | `Client` `Browser` `Mobile` `Team` |
| operations | `Monitoring` `Logging` `Alerting` `Scheduler` `Pipeline` |

**Role precedence.** A reference may name the role before the handle, `Server api`, to say which
element it means. Without a role, a handle that more than one element has means the first of them in
this order, and the editor warns: the roles in the table above, then `Group`, then `Note`.

```text
Server Function Container Service Registry
Database Cache Queue Topic Storage Bucket Warehouse Search
LoadBalancer Proxy VPN Gateway Firewall Router Secret DNS
CDN Internet
Client Browser Mobile Team
Monitoring Logging Alerting Scheduler Pipeline
Group
Note
```

## Group Definition

A group draws a container around the things it lists. It lists **handles**, one per line or
separated by spaces.

```text
Group "dbdiagram API servers" as dbdiagram_api { api1 api2 }
```

Members on the line of `{` are handles only. A member on a line of its own is one member: a handle,
or a role and a handle when the handle alone would mean another element.

```text
Group backend {
  Server api
  Group api
  sessions
}
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

The arrow shows who opens the connection. Data may travel both ways over it; say where it goes in a
setting when it matters.

| Operator | Meaning |
|---|---|
| `>` | the left side opens the connection, the right side answers |
| `<` | the right side opens the connection |
| `<>` | each side opens its own connections to the other |
| `-` | not stated |

```text
Link: api > db                                   // the API reads from and writes to the database
Link: standby > primary [proto: replication]     // the standby connects to the primary and pulls its changes
Link: browser > ws [proto: WebSocket]            // the browser opens it; messages go both ways over it
Link: billing <> orders                          // Orders calls Billing to charge; Billing calls Orders back with a webhook
```

Either end may name its role, when the handle alone would mean another element:

```text
Link: client > Group api
```

```text
Link: internet > cloudflare
Link: cloudflare > api  [proto: HTTPS, host: 'api.dbdiagram.com']
Link: api - sessions
```

`proto` and `host` describe the conversation, so they live on the line rather than inside a box:
the same server answers on more than one of them.

A link may end on a group. It goes to the group as a whole and implies no links to its members:
which members it reaches depends on what the group is. Draw the member links when they matter.

```text
Group "Mongo replica set" as mongo_rs { mongo1 mongo2 mongo3 }
Link: dbdiagram_api > mongo_rs     // the API talks to the replica set, not to whichever member is primary today

Group "Private network" as private_net { api mongo_rs redis }
Link: internet > private_net       // traffic enters the network; it says nothing about which hosts it reaches
```

**Inline links.** A link can also be written on the element it leaves, with `link` or `ref`:

```text
Server api [link: > db, link: < queue, ref: <> cache, link: > Group backend]
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

The role may be written before the target, `Metadata Server api1 { ... }`, to say which element it
means. Without one, it follows the role precedence and the editor warns when the handle is shared. A
quoted name is written in double quotes: `Metadata "API 1" { ... }`.

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

Elements can live in their own file and be imported like any other module. A diagram that
imports them can group them and link to them.

```text
// monitoring.arch.dbml
Monitoring "Grafana" as grafana [type: 'grafana']
Monitoring "Prometheus" as prometheus [type: 'prometheus']
```

```text
// main.arch.dbml
use * from './monitoring.arch'

Group "Monitoring system" as monitoring { grafana prometheus }
Link: prometheus > grafana
```

To import only some of them, name each one with its role:

```text
use {
  Monitoring grafana
} from './monitoring.arch'
```

`as` imports an element under another handle. In this file only that handle refers to it, and the
box keeps the name its own file gave it, so a local element may keep the original handle:

```text
use { Monitoring grafana as grafana_shared } from './monitoring.arch'
Monitoring grafana
Link: grafana > grafana_shared
```

## Syntax Consistency

The architecture dialect uses the same punctuation as the rest of DBML.

- curly brackets `{}`: a body, for properties and for group members
- square brackets `[]`: settings on one line
- forward slashes `//`: comments
- single quote as `'string'`: string value
- double quote as `"Drawn Name"`: the name shown on the canvas
- triple quote as `'''multi-line string'''`: multi-line string value
- `as handle`: the name everything else refers to
