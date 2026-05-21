---
title: 'Database Support'
---

# Database Support

This page provides an overview of which databases are supported across DBML's different capabilities.

## Support Matrix

| Database | Import (SQL to DBML) | Export (DBML to SQL) | Connector |
|----------|:--------------------:|:--------------------:|:---------:|
| PostgreSQL | ✓ | ✓ | ✓ |
| MySQL | ✓ | ✓ | ✓ |
| MSSQL (SQL Server) | ✓ | ✓ | ✓ |
| Oracle | ✓ | ✓ | ✓ |
| Snowflake | ✓ | — | ✓ |
| BigQuery | — | — | ✓ |

**Legend:**
- ✓ = Supported
- — = Not supported

## Capabilities

### Import (SQL to DBML)

Convert SQL DDL scripts to DBML format using [@dbml/core](./js-module/core.md).

```javascript
const { importer } = require('@dbml/core');
const dbml = importer.import(sqlScript, 'postgres');
```

### Export (DBML to SQL)

Generate SQL DDL scripts from DBML using [@dbml/core](./js-module/core.md).

```javascript
const { exporter } = require('@dbml/core');
const sql = exporter.export(dbmlContent, 'postgres');
```

### Connector

Connect directly to a live database and extract its schema using [@dbml/connector](./js-module/connector.md).

```javascript
const { connector } = require('@dbml/connector');
const schemaJson = await connector.fetchSchemaJson(connectionString, 'postgres');
```
