# Setup guide
## Install antlr4-tools
- https://github.com/antlr/antlr4-tools
  ``` bash
  pip install antlr4-tools
  # Run antlr4 to check the version and help
  ```
  Note:
    - For Mac OS:
      - if `openjdk` is not installed, please run: `brew install openjdk`
      - if can not found any Java runtime, run `brew info openjdk` and follow instruction to add `CPPFLAGS`
      - if can not get latest version due to SSL error, please try to reinstall the latest version of python: https://www.python.org/downloads/macos/ then remove the older version folder
## Read the guide
- https://github.com/antlr/antlr4/blob/master/doc/javascript-target.md
## Setup new parser
- Go to https://github.com/antlr/grammars-v4/tree/master/sql and copy `<lang>Lexer.G4` and `<lang>Paser.G4` to `src/<lang>` folder.
- Run these commands:
  ``` bash
  antlr4 -Dlanguage=JavaScript -no-listener -visitor <path-to-lexer>
  antlr4 -Dlanguage=JavaScript -no-listener -visitor <path-to-parser>
  ```
- Update visitor file based on our use-cases
## Write visitor
- See example file `src/sqlite/test.js` for how to run the visitor
- We can traverse through the visitor to generate our DBML's `model_structure`

## Next steps
- Complete a working example & test for SQLite
- Create visitor for Postgres/MySQL/MSSQL

# Why this repo exists
- We need to create our custom parser for SQLs but the parser is only partial correct and take much time to fix bugs or improve it
- ANTLR4 repo contains many up-to-date SQL parsers so we don't need to reinvent the wheel
- We only need to focus on mapping the SQL parsers with our DBML structure

# Useful resources
- https://www.antlr.org/api/Java/org/antlr/v4/runtime/RuleContext.html