import fs from 'fs';
import Parser from './Parser';

const str = `
Table "user" [headerColor: #555] {
  "id" int [pk]
  "name" string
}

Table "country" [note: 'name is required'] {
  "id" int [pk]
  "name" string [not null]
}

Table "product" [headerColor: #17DACC, note: 'product must have price'] {
  "id" int [pk]
  "name" string
  "price" decimal [not null]
}

Table "merchant" [headerColor: #08DAFF, note: 'merchants sell a lot'] {
  "id" int [pk]
  "user_id" int
  "product_id" int
  "address" string
}

Ref:"user"."id" < "merchant"."user_id"

Ref:"product"."id" < "merchant"."product_id"
`;

const res = Parser.parseDBMLToJSON(str);
fs.writeFileSync('src/parse/test1.json', JSON.stringify(res, null, 2));
