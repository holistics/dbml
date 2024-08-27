---
title: '@dbml/connector'
---

[![NPM](https://img.shields.io/npm/v/@dbml/connector)](https://www.npmjs.com/package/@dbml/connector)

This package is responsible for connecting to a database on your local environment and fetch its schema information.

## Supported Databases

- PostgreSQL
- MySQL
- MSSQL

## Prerequisites

- **Nodejs** version 18.0.0 or higher.

## Installation

```bash npm2yarn
npm install @dbml/connector
```

## APIs

### connector

```javascript
const { connector } = require('@dbml/connector');
```

#### `connector.fetchSchemaJson(connection, format)`

- **Arguments:**
  - `{string} connection`
  - `{'postgres'|'mssql'|'mysql'} format`

- **Returns:**
  - `{DatabaseSchema} schemaJson`

- **Usage:**
Generate `DatabaseSchema` object directly from a database.

```javascript
const { connector } = require('@dbml/connector');

const connection = 'postgresql://dbml_user:dbml_pass@localhost:5432/schema';
const format = 'postgres';

const schemaJson = await connector.fetchSchemaJson(connection, format);
```

:::info
The type definition of `DatabaseSchema` object can be found [here](https://github.com/holistics/dbml/blob/a4dcb110f1d79f5d95b0d3db4b919914439e039d/packages/dbml-connector/src/connectors/types.ts#L89).
:::
