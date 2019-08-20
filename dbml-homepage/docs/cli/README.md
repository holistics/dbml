# CLI
DBML comes with a built-in CLI which can be used to import and export files from
the command line  

![img](./cli.gif)
## Installation
```bash
npm install -g @dbml/cli
# or
yarn global add @dbml/cli
```

## Usage

```bash
dbml <command> [<args>]

* dbml [-v|--version]

* dbml [-h|--help]

* dbml import [--mysql|--postgres] <input-pathspec> [-o|--output <output-pathspec>]

* dbml export [--mysql|--postgres] <input-pathspec> [-o|--output <output-pathspec>]
```

### Import file

```bash
dbml import [--mysql|--postgres] <input-pathspec> [-o|--output <output-pathspec>]
```

#### Args

* **-- mysql, --postgres**  
Specify the import format.

* **input-pathspec**  
The path to the file or directory that you want to import from.
  * *path to a file:*  
     DBML-CLI will import from the file.
  * *path to a directory:*  
     DBML-CLI will try to import all files with file extension specified in 
     the option but you should distinguish between MySQL files and PostgreSQL files, also the output-pathspec
     is expected to be an existed directory.
 
* **-o, --output**  
Specify the generated file path. If omitted, the default generated file path will be at the current directory and file names 
will be the same as input's file names

#### Examples

* Generate `schema.dbml` from `postgres.sql`:

```bash
$ dbml import --postgres postgres.sql --output ./db/schema.dbml
```

* Omitting -o, - - output option:

```bash
$ dbml import --mysql mysql.sql
```

The dbml file will be generated as `mysql.dbml` in the current directory

* Generate dbml files in `/dbml` directory from all PostgreSQL files in `/postgres` directory:

```bash
$ dbml import --postgres ./postgres -o ./dbml
```

### Export file

```bash
$ dbml export [--mysql|--postgres] <input-pathspec> [-o|--output <output-pathspec>]
```

#### Args

* **-- mysql, --postgres**  
Specify the export format.

* **input-pathspec**  
The path to the file or directory that you want to export to.
  * *path to a file:*  
     DBML-CLI will try to export from the .dbml file to the specified format.
  * *path to a directory:*  
      DBML-CLI will try to export all .dbml files from the directory to the specified format. 
      The output-pathspec is expected to be an existed directory.
 
* **-o, --output**  
Specify the generated file path. If omitted, the default generated file path will be at the current directory and file names 
will be the same as input's file names

#### Examples

* Export `schema.dbml` to `postgres.sql`:

```bash
$ dbml export --postgres schema.dbml --output postgres.sql
```

* Export all dbml files in `/dbml` directory to JSON format in `/postgres` directory:

```bash
$ dbml export --postgres ./dbml -o ./postgres
```