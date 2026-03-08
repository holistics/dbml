Table "products" {
  "id" uuid [pk]
  "kind" text [not null]
  "name" text

  Indexes {
    (kind, name) [unique, name: "products_kind_name_key"]
  }
}
