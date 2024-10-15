Table "follows" {
  "following_user_id" integer
  "followed_user_id" integer
  "created_at" timestamp
}

Table "users" {
  "id" integer [pk]
  "username" varchar
  "role" varchar
  "created_at" timestamp
}

Table "posts" {
  "id" integer [pk]
  "title" varchar
  "body" text [note: 'Content of the post']
  "user_id" integer
  "status" varchar
  "created_at" timestamp
}

Ref:"users"."id" < "posts"."user_id"

Ref:"users"."id" < "follows"."following_user_id"

Ref:"users"."id" < "follows"."followed_user_id"

Note note1 {
  'sticky note with one line content'
}

Note random_sticky_note_name {
  '''Sticky note
With content
That spans
Multiple lines
'''
}

Note wrogn_noet_naem {
  '''Maybe you read the note\'s name as "wrong note name", and you had that wrong =))
'''
}
