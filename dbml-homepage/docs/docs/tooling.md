# Tooling

## core

### Installation
```bash
npm install @dbml/core
# or
yarn add @dbml/core
```

### APIs

#### importer
```javascript
import { importer } from '@babel/core';
```

##### .import(str, format)

* **Arguments:**  
  * ```{string} str```
  * ```{'json'|'mysql'|'postgres'|'schemarb'} format```

* **Returns:** the dbml string
* **Usage:**  
Generate dbml from other formats

#### exporter
```javascript
import { exporter } from '@babel/core';
```

##### .export(str, format)

* **Arguments:**  
  * ```{string} str```
  * ```{'json'|'mysql'|'postgres'} format```

* **Returns:** the exported format string
* **Usage:**  
Export dbml to other formats

#### Parser Object

```javascript
import { Parser } from '@dbml/core';
const parser = new Parser();
```

##### .parse(str, format)
* **Arguments:**  
  * ```{string} str```
  * ```{'json'|'mysql'|'postgres'|'dbml'|'schemarb'} format```

* **Returns:** ```Schema``` Object
* **Usage:**  
Parse specified format to ```Schema``` Object

#### SchemaExporter Object

```javascript
import { SchemaExporter } from '@dbml/core';
const schemaExporter = new SchemaExporter(schema); // schema is the Schema Object
```

##### .export(format)
* **Arguments:**  
  * ```{'json'|'mysql'|'postgres'|'dbml'} format```

* **Returns:** format string
* **Usage:**  
Export ```Schema``` Object to specified format string