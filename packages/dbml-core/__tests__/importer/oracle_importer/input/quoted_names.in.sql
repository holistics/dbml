CREATE TABLE " aba " (
  "birthday" "string COLLATE Latin1_General_CS_AS",
  "date of birth" "string",
  CONSTRAINT " primary key bd " PRIMARY KEY("date of birth"),
  CONSTRAINT " foreign key bd " 
  FOREIGN KEY ("date of birth") REFERENCES "silver  users"("date of birth")
);

CREATE TABLE "silver  users" (
  "children  " integer CONSTRAINT "check children > 0" CHECK ("children  " > 0),
  "date of birth" "string"
);

CREATE INDEX "index on silver" ON "silver  users"("date of birth", ' a aaa ');

ALTER TABLE "silver  users"
ADD CONSTRAINT "silver dob"
CHECK ("date of birth" IS NOT NULL);
