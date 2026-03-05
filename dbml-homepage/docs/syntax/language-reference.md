---
title: Language Reference
---

# Language Reference

This section describes the language-level constructs that apply across all DBML definitions.

- [Multi-line String](#multi-line-string)
- [Comments](#comments)
- [Syntax Consistency](#syntax-consistency)

## Multi-line String

Multiline string will be defined between triple single quote `'''`

```text
Note: '''
  This is a block string
  This string can spans over multiple lines.
'''
```

- Line breaks: \<enter\> key
- Line continuation: `\` backslash
- Escaping characters:
  - `\`: using double backslash `\\`
  - `'`: using `\'`
- The number of spaces you use to indent a block string will be the minimum number of leading spaces among all lines. The parser will automatically remove the number of indentation spaces in the final output. The result of the above example will be:

```text
  This is a block string
  This string can spans over multiple lines.
```

## Comments

**Single-line Comments**

You can comment in your code using `//`, so it is easier for you to review the code later.

Example,

```text
// order_items refer to items from that order
```

**Multi-line Comments**

You can also put comment spanning multiple lines in your code by putting inside `/*` and `*/`.

Example,

```text
/*
  This is a
  Multi-lines
  comment
*/
```

## Syntax Consistency

DBML is the standard language for database and the syntax is consistent to provide clear and extensive functions.

- curly brackets `{}`: grouping for indexes, constraints and table definitions
- square brackets `[]`: settings
- forward slashes `//`: comments
- `column_name` is stated in just plain text
- single quote as `'string'`: string value
- double quote as `"column name"`: quoting variable
- triple quote as `'''multi-line string'''`: multi-line string value
- backtick `` ` ``: function expression
