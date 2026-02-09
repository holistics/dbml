Table "users" {
  "id" integer [pk]
  "name" varchar(255)
  "email" varchar(255)
  "active" boolean
}

Table "comments" {
  "id" integer [pk]
  "user_id" integer
  "content" text
}

Records users(id, name, email, active) {
  1, 'Alice', 'alice@example.com', true
  2, 'Bob', 'bob@example.com', false
  3, 'Charlie', 'charlie@example.com', true
  4, 'Dave', 'dave@example.com', false
}

Records comments(id, user_id, content) {
  1, 1, 'Great post!'
  2, 2, 'Nice article'
  3, 1, 'Thanks for sharing'
}
