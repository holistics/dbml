# DBML - Database Markup Language

DBML (database markup language) is a simple, readable DSL language designed to define database structure and definitions.

## Benefits:

- It is database agnostic
- Yet can cater for each of the database's unique features
- It is highly human-readable

Consider the following SQL DDL statements that define a table with a few columns and indexes

```sql
CREATE TABLE "users"
(
  id integer primary key,
  username varchar(255) not null unique,
  created_at timestamp without time zone default NOW()
);
    
comment on column users.username is 'Used to log in';
    
CREATE INDEX on users (username);
CREATE INDEX on users (created_at);
```

Compare that with a DBML syntax:

    Table users {
      id integer [primary key],
      username varchar(255) [unique, not null, note: "Used to log in"],
      created_at timestamp without time zone [default: 'now()']
    
      indexes {
        created_at,
        username
      }
    }
