# CLI
DBML comes with a built-in CLI which can be used to import and export files from
the command line

## Install
```bash
npm install -g @dbml/cli
# or
yarn global add @dbml/cli
```

## Import files
Generate DBML files from other other formats.

```bash
dbml import [--mysql|--postgres|--json|--schemarb] <pathspec> [-o|--output <pathspec>]
```

### Options

* **--mysql, --postgres, --json, --schemarb**  
Specify the import format (default is JSON)

* **-o, --output**  
Specify the generated file path. If omitted, the default generated file path will be
at the current directory and file names will be the same as input's file names

### Examples

* Generate **schema.dbml** from **postgres.sql**

```bash
dbml import --postgres postgres.sql --output ./dbml/schema.dbml
```

* Omitting --output option

```bash
dbml import --mysql ./schema.sql
```

The dbml file will be generated as ```schema.dbml``` in the current directory.

* Generate dbml files in ```/dbml``` directory from all PostgreSQL files in ```/postgres``` directory

```bash
dbml import --postgres ./postgres -o ./dbml
```

## Export files
Export DBML files to other formats

```bash
dbml export [--mysql|--postgres|--json] <pathspec> [-o|--output <pathspec>]
```

### Options

* **--mysql, --postgres, --json**  
Specify the export format (default is JSON)

* **-o, --output**  
Specify the generated file path. If omitted, the default generated file path will be at the current directory and file names will be the same as input's file names

### Examples

* Export ```schema.dbml``` to ```postgres.sql```

```bash
dbml export --postgres schema.dbml --output postgres.sql
```

* Export all dbml files in ```/dbml``` directory to JSON in ```/json``` directory

```bash
dbml export --json ./dbml --output ./json
```

## Visualize with [dbdiagram.io](https://dbdiagram.io)
(Coming soon)