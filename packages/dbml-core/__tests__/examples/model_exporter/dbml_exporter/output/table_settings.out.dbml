Table "user" as U [headerColor: #555] {
  "id" int [pk]
  "name" string
}

Table "country" {
  "id" int [pk]
  "name" string [not null]
  Note: 'name is required'
}

Table "product" [headerColor: #17DACC] {
  "id" int [pk]
  "name" string
  "price" decimal [not null]
  Note: 'product must have price'
}

Table "merchant" [headerColor: #08DAFF] {
  "id" int [pk]
  "user_id" int
  "product_id" int
  "address" string
  Note: 'merchants sell a lot'
}

Ref:"user"."id" < "merchant"."user_id"

Ref:"product"."id" < "merchant"."product_id"
