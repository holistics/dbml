Table "users" {
  "id" integer [pk]
  "name" varchar(255)
  "email" varchar(255)
}

Table "posts" {
  "id" integer [pk]
  "user_id" integer
  "title" varchar(255)
}

Records users(id, name, email) {
  1, 'Alice', 'alice@example.com'
  2, 'Bob', 'bob@example.com'
  3, 'Charlie', 'charlie@example.com'
  4, 'Dave', 'dave@example.com'
}

Records posts(id, user_id, title) {
  1, 1, 'First Post'
  2, 1, 'Second Post'
  3, 2, 'Bob Post'
}
