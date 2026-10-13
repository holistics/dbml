# @dbml/arch

The architecture dialect. DBML's front end, a different vocabulary.

```
Internet   pub_net    [name: 'Internet']
Cloudflare cloudflare [name: 'Cloudflare']
LoadBalancer do_lb_be [name: 'dbdiagram-do-lb-be']

Group mongo_rs [name: 'mongodb replica set'] { mongo1  mongo2  mongo3 }

Link: cloudflare > do_lb_be [proto: HTTPS, host: 'api.dbdiagram.com']
Link: dbdiagram_api > mongo_rs
```

**A node is an icon and a name.** The protocol and the host live on the LINE, because that is
what they describe: the same server answers on more than one of them, and the conversation is
the thing being named. An earlier draft put rows inside the boxes for this, by analogy with
DBML's columns. The analogy cost a wider box, a second rectangle to anchor lines against, a
plate to paint and a second way to spell an endpoint, and it bought a distinction the drawing
was not making. It is gone.

**A link may end on a container.** `api1 > mongo1` is a claim about failover that nobody meant
to make; `dbdiagram_api > mongo_rs` is what is true.

## What it reuses, and what it had to change

The lexer is 642 lines and mentions no DBML word. `parser.ts` is 1,623 lines and the string
`ElementKind` appears in it zero times: there is one generic `elementDeclaration()`, and which
words are legal is decided a stage later. `compiler/index.ts` mentions `SchemaElement` four
times, all of them in comments. The DBML-specific part of the package is the 10,362 lines under
`core/global_modules`.

So a dialect is a different module list, not a different grammar. A probe of twenty
architecture constructs through DBML's parser found eighteen that parse unchanged, including
`[settings]`, `a > b`, `a <> b`, nested group bodies and `use * from`. Two did not, and both
are now switches that are off for DBML:

| Change | Where | Default |
|---|---|---|
| the element vocabulary is a constructor argument | `Compiler`'s second parameter | `dbmlModules` |
| an element may have no body | `ParserOptions.allowBodylessElement` | off |

`Database mongo1` is a complete statement here and nothing in DBML reads that way, because every
DBML element carries something: a Table has columns, a Ref has endpoints. Writing
`Database mongo1 { }` on every line to satisfy a rule that exists for another language would be
the tail wagging the dog.

Front matter (`---\ntitle: x\n---`) is the one construct still unsupported. It needs the lexer,
not the parser, and nothing depends on it yet: `Project { ... }` already carries file-level
metadata, and its interpreter files any unrecognised field as a free-form property, which is how
`database_type` works and how `diagram_type` works here.

The whole DBML suite, 2,043 tests, passes unchanged with both switches in place.

## What decides that a document is architecture

Not its name. dbdiagram's cloud documents have no path at all, so a filename can never be the
signal, and a test pins that: the same source compiles identically as `/infra.arch.dbml`, as
`/untitled.dbml` and as `/d`.

What decides it is the content. A document with `Kind` declarations and elements built on them
is an architecture diagram wherever it is stored, whether the vocabulary is written inline or
imported from a pack.

```
Project dbx {
  diagram_type: 'architecture'   // advice, never a mode
}
```

That marker decides which canvas a host opens on and which completions it offers, and nothing
else. It earns its place on the one case inference cannot cover: a document holding four `Kind`
lines and nothing drawn yet is not "unknown", it is an architecture diagram nobody has drawn on,
and a canvas must not flicker between answers while somebody is typing.

Crucially the marker does **not** change parsing. `allowBodylessElement` is a parser option and
has to be known before parsing begins, so a marker that changed the grammar would mean lex, scan
for the marker, then parse: a dependency cycle for something that only picks a canvas.

## Naming

`main.arch.dbml`, by convention and never by requirement. The language goes last, the way it
does in `.d.ts` and `.spec.ts`. That is not only taste:

| Spelling | `use` specifier | Stock resolver |
|---|---|---|
| `devops.dbml` | `'./packs/devops'` | reaches it |
| `devops.arch.dbml` | `'./packs/devops.arch'` | reaches it, unchanged |
| `devops.dbml.arch` | `'./packs/devops.dbml'` | misses |
| `devops.dbml.arch` | `'./packs/devops'` | misses |

DBML's resolver appends `.dbml` to a specifier that does not already end in it. Spelled the
other way round every form misses, and every tool that keys on the last extension, VS Code,
Linguist, a CI glob, stops seeing DBML.

## What this package owns

Binding and interpretation, in `compile.ts`. They are deliberately **not** written as
`GlobalModule`s yet. A module buys symbol-level editor services, go to definition, rename, find
references, at the cost of a symbol kind per element inside DBML's own enum. Nothing asks for
those services today. When the editor does, `compile.ts` is what becomes the modules, and the
seam it would plug into already exists.

`read.ts` is the only file that touches the shape of a syntax node. If DBML's AST moves, that
file moves and nothing else does.

## The renderer

`@holistics/dbx-graph-renderer` draws the result. It knows nothing about DBML or about any parser: it declares
its own input contract in `src/model.ts` and draws anything that satisfies it. That is why the
playground tab is thirty lines of wiring rather than a port.

It lives in `holistics/dbx-graph-renderer`, which is closed, and **this repository does not depend
on it**: `@dbml/arch` owns the model (`src/model.ts`) and the icon names (`src/icons.ts`), so
the language works without the drawing. The only thing that needs it is the playground's
Architecture tab, through one alias in `dbml-playground/vite.config.ts`, and the playground is
not published.

## Running it

```bash
yarn vitest run                       # 16 tests
yarn --cwd ../../dbml-playground dev  # the Architecture tab, http://localhost:3001
```

`@holistics/dbx-graph-renderer` is closed and is not on the registry yet, so link it:

```bash
cd ~/<wherever>/dbx-graph-renderer && yarn link
cd ~/<wherever>/dbml/dbml-playground && yarn link @holistics/dbx-graph-renderer
```

Without it everything works except the Architecture tab.

The playground resolves `@dbml/arch` and the renderer from source, so edits to either are live.
`@dbml/parse` is the exception: its own sources use `@/` to mean its own `src`, which collides
with the playground's `@` alias, so it runs from `dist`. Run `yarn build` in
`packages/dbml-parse` after touching the kernel.
