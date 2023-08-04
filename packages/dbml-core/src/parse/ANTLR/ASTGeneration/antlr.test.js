import importer from '../../../import';
import { parse } from './index';

const input = `
CREATE TYPE "product status" AS ENUM (
  'Out of Stock',
  'In Stock'
);

CREATE TABLE schemaB.artist(
  artistid    INTEGER PRIMARY KEY,
  artistname  TEXT UNIQUE NOT NULL,
  "cust_id" NUMBER(10) NOT NULL,
  "status" NVARCHAR (1) NOT NULL,
  CONSTRAINT "column_name" CHECK (("options" = ANY (ARRAY['OPTION1', 'OPTION2'])))
);

ALTER TABLE schemaB.artist ADD CONSTRAINT "column_name2" CHECK (("options" = ANY (ARRAY['OPTION1', 'OPTION2'])));

COMMENT ON TABLE "schemaB"."artist" IS 'This is a note in table "artist"';

COMMENT ON COLUMN "schemaB"."artist".artistname IS 'This is a column note';

CREATE TABLE "schemaB"."track"(
  trackid     INTEGER PRIMARY KEY,
  trackname   TEXT,
  name TEXT,
  trackartist INTEGER REFERENCES schemaB.artist
);
CREATE INDEX trackindex ON schemaB.track(trackartist);

CREATE TABLE album(
  albumartist TEXT,
  albumname TEXT,
  albumcover "product status",
  PRIMARY KEY(albumartist, albumname)
);

CREATE TABLE song(
  songid     INTEGER,
  songartist TEXT,
  songalbum TEXT REFERENCES "schemaB"."track" (trackname),
  songname   TEXT REFERENCES "schemaB"."track",
  FOREIGN KEY(songartist, songalbum) REFERENCES album(albumartist, albumname)
);

CREATE TABLE "foo" (
  "bar" text[],
  "bar2" int [ 1 ],
  "bar3" int[2][3 ],
  "bar4" int array,
  "bar5" int ARRAY [2],
  "bar6" text ARRAY[8],
  "bar7" text ARRAY[ 100 ],
  "bar8" time(2) with time zone [],
  "bar9" time(1) [1],
  "bar10" time(1) aRRay,
  "bar11" time aRray [5],
  "bar12" timestamp(2) without time zone[10][2][5],
  "bar13" character varying[],
  "bar14" character varying(25) [][2][],
  "bar15" character varying array [76]
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" int PRIMARY KEY DEFAULT 123,
  "name" varchar DEFAULT 'Tea',
  "merchant_id" int NOT NULL,
  "price" float DEFAULT 123.12,
  "status" varchar DEFAULT NULL,
  "created_at" varchar DEFAULT (now()),
  "stock" boolean DEFAULT true,
  "expiration" date DEFAULT (current_date + interval '1 year')
);

ALTER TABLE "foo" ADD CONSTRAINT "fk_composite" FOREIGN KEY ("bar", "bar2") REFERENCES "album";
`;

describe('ANTLR test', () => {
  it('postgres parser - should work', () => {
    const r = parse(input, 'postgres');

    console.log(JSON.stringify(r, null, 2));
  });
  it('postgres to dbml', () => {
    const dbml = importer.import(input, 'postgres');
    console.log(dbml);
  });
});
