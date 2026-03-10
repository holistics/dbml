# DiagramView "Show All" Syntax Options

**Date:** 2026-03-10

## Background

The current DiagramView colon syntax supports:

```dbml
DiagramView my_view {
  Tables: [users, posts]   // show specific
  Tables: all              // show all
  Tables: []               // show nothing
}
```

We want to move to a cleaner **block syntax** where users write explicit inclusion lists.
The mental model is: **"show nothing unless I list it"** (explicit inclusion).

The hard problem: how do you express **"show all"** naturally in a block-based syntax?

## Semantic Rules (agreed)

| Situation | Meaning | `rawDb` value |
|---|---|---|
| Category with specific items | show those items | `[{name:...}, ...]` |
| Category explicitly empty | show nothing | `[]` |
| Category omitted entirely | show nothing | `[]` |
| "Show all" syntax (TBD) | show all | `null` |
| `DiagramView x {}` | show nothing for all | all `[]` |
| `DiagramView x` (no body) | show nothing for all | all `[]` |

---

## Idea 1: Keyword as value (Ansible / SQL style)

```dbml
DiagramView my_view {
  Tables: all
  Notes: [reminder]
  TableGroups: none
  Schemas: [core]
}
```

Uses a plain English keyword after a colon. Familiar from:
- SQL: `GRANT ALL PRIVILEGES`
- Ansible: `--tags all`, `tags: never`
- GitHub Actions: `branches: ['*']`

**Pros:**
- Most readable for non-programmers — "Tables: all" is plain English
- `none` makes the "show nothing" intent explicit (even though omission already means nothing)
- Consistent with current colon syntax — minimal migration cost
- No new parsing complexity

**Cons:**
- Colon syntax is less visually clean for multi-item lists
- Mixes two styles: `Tables: all` (keyword) vs `Tables: [a, b]` (list)
- Does not achieve the block syntax aesthetic the user wants

---

## Idea 2: Spread operator inside block (Nix / JS style)

```dbml
DiagramView my_view {
  Tables {
    ...            // show all tables
  }

  Notes {
    reminder       // show specific note
  }

  TableGroups {}   // show nothing
}
```

`...` means "everything" — borrowed from JavaScript spread (`...arr`), Nix attribute spread (`{ x, ... }`), and GraphQL fragments (`...FragmentName`).

**Pros:**
- Block syntax is 100% consistent — always `Category { ... content ... }`
- `...` is universally recognized by developers as "the rest / everything"
- Empty block `{}` clearly means nothing; `{ ... }` clearly means all
- Visually distinct from a table name — no ambiguity

**Cons:**
- `...` may confuse non-programmer DBML users
- Could be mistaken for a fragment reference (GraphQL) or variadic args
- Three dots is a lot of punctuation for "all"

---

## Idea 3: Wildcard suffix on category name (glob style)

```dbml
DiagramView my_view {
  Tables*           // show all tables

  Notes {           // show specific notes
    reminder
  }

  TableGroups {}    // show nothing
}
```

`Tables*` uses `*` as a suffix wildcard — familiar from CSS `*`, SQL `SELECT *`, gitignore `*.log`.

**Pros:**
- `*` is universally understood as "wildcard / all"
- Very concise — one character
- Visually distinct from `Tables { ... }` block form
- Familiar to both programmers and power users

**Cons:**
- `Tables*` could be misread as a glob pattern matching "any category starting with Tables"
- Mixes two syntax forms: `Tables*` (suffix) vs `Tables { ... }` (block) — inconsistent shape
- The `*` after a word (no space) looks like a pointer dereference in C

---

## Idea 4: Separate include/exclude blocks (Gradle / GitHub Actions style)

```dbml
DiagramView my_view {
  Tables {
    include { users, posts, core.orders }
    exclude { audit_logs }
  }

  Notes {
    include { reminder }
  }
}
```

Explicit `include`/`exclude` sub-blocks. Used in Gradle source sets, GitHub Actions `branches-ignore`.

**Pros:**
- Most unambiguous — polarity (include vs exclude) is always explicit
- Supports exclusion from "all" naturally: `include { all } exclude { audit_logs }`
- Machines parse it trivially — no semantic inference needed

**Cons:**
- Most verbose of all options — two levels of nesting for a simple list
- Nobody writes a filter this way in a visual diagram tool
- Overkill for the common case (specific inclusion list)
- `include { all }` still needs a keyword for "all"

---

## Idea 5: `+` prefix inside block (diff / patch style)

```dbml
DiagramView my_view {
  Tables {
    + users
    + posts
    + core.orders
  }
}
```

Every included item is prefixed with `+`. Inspired by git diff, patch files, and some config formats.

**Pros:**
- Explicit intent per item — no ambiguity about what is included
- Easy to add exclusion later with `-` prefix
- Familiar to developers who use git daily

**Cons:**
- Verbose — every single item needs a `+`
- Unnatural for non-programmers
- The `+` feels redundant when all items are included (why prefix everything?)
- DBML style is clean and symbol-light — this adds noise

---

## Idea 6: `all` keyword inside block (plain English)

```dbml
DiagramView my_view {
  Tables {
    all            // special keyword = show all tables
  }

  Notes {
    reminder       // show specific note
  }

  TableGroups {}   // show nothing (empty block)
}
```

`all` is a reserved keyword when it appears alone inside a category block.

**Pros:**
- Block syntax is 100% consistent — always `Category { content }`
- `all` reads as natural English — "Tables, all of them"
- No symbols — clean and minimal
- Easy to parse: if body contains only `all`, treat as "show all"
- Familiar from SQL (`GRANT ALL`), Ansible (`tags: all`), GitHub Actions

**Cons:**
- `all` becomes a reserved keyword — a table literally named `all` would conflict
- A user might not know `all` is special without reading docs
- Less visually distinct than a symbol like `*` or `...`

---

## Idea 7: `*` as a standalone item inside block (SQL SELECT style)

```dbml
DiagramView my_view {
  Tables {
    *              // show all tables
  }

  Notes {
    reminder       // show specific note
  }

  TableGroups {}   // show nothing
}
```

`*` appears as a regular item inside the block — just like `SELECT *` in SQL means "all columns" within a query body.

**Pros:**
- Block syntax is 100% consistent — always `Category { content }`
- `*` inside a block reads naturally as "all of these"
- SQL `SELECT *` is one of the most recognized patterns in tech
- Visually distinct from table names — no naming conflict risk
- One character — most concise of all options

**Cons:**
- `*` alone on a line may look like a markdown bullet to some users
- Could be confused with a glob pattern (does `*` match all tables, or tables named `*`?)
- Less natural for non-programmers compared to `all`

---

## Idea 8: Exclamation mark prefix for exclusion (gitignore / negation style)

```dbml
DiagramView my_view {
  Tables {
    users
    posts
    !audit_logs    // exclude this one
  }
}
```

All items are included by default, and `!` negates specific ones. Familiar from `.gitignore`, GitHub Actions branch patterns, and CSS `:not()`.

**Pros:**
- Enables "show all except X" pattern without needing a separate `all` keyword
- `!` prefix reads naturally as "not this one"
- Familiar to any developer who has used `.gitignore`
- Opens a path to powerful filtering: list some, exclude others

**Cons:**
- Does not solve "show all" on its own — still needs a way to say "start from all"
- Mixing inclusion and exclusion in one block may confuse users
- DBML style currently has no negation concept — adds new mental model

---

## Idea 9: `Tables (all)` — inline modifier in parentheses (function call style)

```dbml
DiagramView my_view {
  Tables (all)       // show all tables

  Notes {            // show specific
    reminder
  }

  TableGroups ()     // show nothing (empty parens)
}
```

Parentheses act as a modifier or argument to the category keyword — inspired by function call syntax and CSS pseudo-classes like `:is(a, b)`.

**Pros:**
- Inline and compact — no block needed for the "all" case
- `()` for empty and `(all)` for all is visually symmetric
- Feels like a function: "give me Tables(all)"
- Parens are already used in DBML for field types like `varchar(255)`

**Cons:**
- Inconsistent with block syntax — `Tables (all)` vs `Tables { users }` mixes two forms
- `()` for "nothing" is unconventional — empty parens usually means "no arguments", not "nothing"
- DBML already uses parens for type constraints — overloading parens may confuse parsers

---

## Idea 10: No "show all" syntax — omit the category (zero-syntax approach)

```dbml
DiagramView my_view {
  // Only list categories you want to filter
  // Omit a category entirely to show all of it

  Notes {
    reminder
  }
  // Tables, TableGroups, Schemas not listed = show ALL of them
}
```

Flip the omission rule: **omit = show all**, **empty block = show nothing**. The opposite of the current proposal.

**Pros:**
- No special syntax needed for "show all" — just don't write it
- Most concise possible representation
- Natural for the common case: "I only want to filter Notes, show everything else"
- `DiagramView my_view {}` clearly means "show nothing for all"

**Cons:**
- **Directly contradicts the agreed mental model** — "show nothing unless I list it"
- `DiagramView my_view {}` = show nothing, but omitting all categories also means show all — confusing asymmetry
- A user reading the file cannot tell if a missing category was intentional or forgotten
- Harder to reason about: presence means filter, absence means show all

---

## Idea 11: `~` tilde as "all" sigil (complement / universe symbol)

```dbml
DiagramView my_view {
  Tables {
    ~              // show all — tilde means "full set / complement"
  }

  Notes {
    reminder
  }

  TableGroups {}   // show nothing
}
```

`~` is used in mathematics and set theory to denote "complement" or "universal set." Also used in CSS `~` sibling combinator and some shell expansions.

**Pros:**
- Block syntax stays 100% consistent
- `~` is visually distinctive — unlikely to be mistaken for a table name
- In set theory, `~` connotes "the whole universe of this set"
- One character, easy to type

**Cons:**
- Very unfamiliar in this context — requires documentation
- Most users associate `~` with home directory (`~/`) or bitwise NOT (`~x`)
- Too clever — sacrifices readability for brevity

---

## Comparison Table

| Idea | "Show all" syntax | Block consistent? | Non-programmer friendly? | Ambiguity risk |
|---|---|---|---|---|
| 1. Keyword as value | `Tables: all` | No (colon style) | High | Low |
| 2. Spread `...` | `Tables { ... }` | Yes | Medium | Low |
| 3. Wildcard suffix | `Tables*` | No (mixed forms) | High | Medium |
| 4. include/exclude | `include { all }` | Yes (verbose) | Low | Low |
| 5. `+` prefix | `Tables { + a + b }` | Yes | Low | Low |
| 6. `all` keyword | `Tables { all }` | Yes | High | Medium (reserved word) |
| 7. `*` inside block | `Tables { * }` | Yes | Medium | Low |
| 8. `!` negation | `Tables { !audit }` | Yes (exclusion only) | Medium | Low |
| 9. Inline parens | `Tables (all)` | No (mixed forms) | Medium | Medium |
| 10. Omit = show all | *(don't write it)* | Yes | High | High (intent unclear) |
| 11. `~` tilde | `Tables { ~ }` | Yes | Low | Low |

---

## Recommendation

**Idea 6 (`all` keyword inside block)** and **Idea 2 (`...` spread)** are the strongest candidates because they keep the block syntax fully consistent — `Category { }` is always the form, and the content determines the meaning.

Between the two:
- Choose **Idea 6** if your user base includes non-programmers — `all` is plain English
- Choose **Idea 2** if your user base is developers — `...` is a recognized programming idiom

A hybrid is also possible:

```dbml
DiagramView my_view {
  Tables {
    all            // or ... — both accepted as aliases
  }
  Notes {
    reminder
  }
  TableGroups {}
}
```

This gives users flexibility and makes migration from existing `Tables: all` syntax straightforward.
