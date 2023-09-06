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
## ANTLR4 Guide
- https://github.com/antlr/antlr4/blob/master/doc/javascript-target.md
## Setup a new parser
1. Create a new folder inside the `packages/dbml-core/src/parse/ANTLR/parsers` folder (e.g. `postgresql`)
2. Go to https://github.com/antlr/grammars-v4/tree/master/sql and clone the `<lang>Lexer.G4` and `<lang>Parser.G4` to the newly created folder.
3. Go to the folder:
    ```
    cd packages/dbml-core/src/parse/ANTLR/parsers/postgresql
    ```
4. Run these commands:
    ``` bash
    antlr4 -Dlanguage=JavaScript -no-listener -visitor <path-to-lexer>
    antlr4 -Dlanguage=JavaScript -no-listener -visitor <path-to-parser>
    ```
5. Write the visitor to generate the AST


# Useful resources
- https://www.antlr.org/api/Java/org/antlr/v4/runtime/RuleContext.html
- https://github.com/antlr/antlr4-tools