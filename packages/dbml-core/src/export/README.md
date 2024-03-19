# DBML Exporter

## DBML vs Oracle Mapping

Currently, our exporter supports Oracle version 19c syntax.

| DBML | Oracle | Notes |
|  ---  |  ---  |  ---  |
| **Schema** | Schema - User |  |
| **Table** | Table |  |
|  `note`  | Table comment |  |
| **Column** | Column |  |
| `note` | Column comment |  |
| `primary key or pk` | PRIMARY KEY constraint |  |
| `null or not null` | NULL or NOT NULL constraint |  |
| `unique` | UNIQUE constraint |  |
| `default` | DEFAULT value |  |
| `increment` | Identity column |  |
| **Index** | Index |  |
| `type` | Index type |  |
| `name` | Index name |  |
| `unique` | Unique index |  |
| Index with an expression | Function-based index |  |
| Composite index | Index on multiple columns |  |
| **Relationship** | Foreign key |  |
| `delete` | ON DELETE clause |  |
| `update` | ❌ |  |
| Many-to-many relationship | ❌ | Use junction table |
| **Composite keys** |  |  |
| Composite primary key | Composite primary key |  |
| Composite foreign key | Composite foreign key |  |
| **Enum** | ❌ | Use CHECK constraint |
