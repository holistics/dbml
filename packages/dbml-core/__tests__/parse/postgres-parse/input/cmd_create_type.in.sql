CREATE TYPE "bug_status" AS ENUM ('new', 'open', 'closed');

CREATE TYPE "float8_range" AS RANGE (subtype = float8, subtype_diff = float8mi);