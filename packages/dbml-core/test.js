import Parser from "./src/parse/Parser";
import ModelExporter from "./src/export/ModelExporter";

const dbml = `Table users as U {
  id int [pk, increment] // auto-increment
  full_name varchar [note: 'should be full name']
  created_at timestamp
  country_code int
  
  note: 'okay this is 1st cmt'
}

Table merchants {
  id int [pk]
  merchant_name varchar [note: 'should be full name 2nd']
  country_code int
  "created at" varchar
  admin_id int [ref: > U.id] // inline relationship (many-to-one)
  
  note: 'okay this is 2nd cmt'
}

Table countries {
  code int [pk]
  name varchar
  continent_name varchar
 }

// Creating references
// You can also define relaionship separatey
// > many-to-one; < one-to-many; - one-to-one
Ref: U.country_code > countries.code  
Ref: merchants.country_code > countries.code
`;

const db = Parser.parse(dbml, 'dbml');
// const dbNormalize = JSON.stringify(db.normalize(), null, 2);
// console.log(dbNormalize);
console.log(ModelExporter.export(db, 'mysql', false));
