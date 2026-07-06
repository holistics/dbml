Table "bad_faith_users" {
  "id" int(11) [pk, not null, increment]
  "user_id" int(11)
  "created" int(11)

  Indexes {
    user_id [type: btree, name: "user_id"]
  }
}

Table "booking" {
  "id" int(11) [pk, not null, increment]
  "user_id_one" int(11)
  "user_id_two" int(11)
  "timezone" varchar(512) [not null, default: '']
  "date" varchar(255)
  "spot" varchar(255)
  "address" text
  "time" varchar(255)
  "is_accept" int(11)
  "message_id" text
  "channel_id" text
  "privateChat" varchar(255)
  "cron_status_before" int(11) [default: '0']
  "cron_status_during" int(11) [default: '0']
  "cron_status_after" int(11) [default: '0']
  "before_time_3hrs" varchar(100)
  "before_time_20mins" varchar(100)
  "after_time_8hrs" varchar(100)
  "user_one_status" tinyint(2) [not null, default: '0']
  "user_two_status" tinyint(2) [not null, default: '0']
  "feedback_notification" int(11) [not null, default: '0']
  "feedback_notification_two" int(11) [not null, default: '0']
  "Created_at" varchar(255) [not null, default: '']

  Indexes {
    user_id_two [type: btree, name: "venue"]
    user_id_one [type: hash, name: "user_id_one"]
  }
}

Table "test0" {
  "id" int(11) [pk, not null, increment]
  "gid" int(11)

  Indexes {
    gid [type: hash, name: "gid"]
  }
}

Table "test1" {
  "id" int(11) [pk, not null, increment]
  "gid" int(11)

  Indexes {
    gid [type: hash, name: "gid"]
  }
}

Table "test2" {
  "id" int(11) [pk, not null, increment]
  "gid" int(11)

  Indexes {
    gid [type: btree, name: "gid"]
  }
}

Table "test3" {
  "id" int(11) [pk, not null, increment]
  "gid" int(11)

  Indexes {
    gid [type: btree, name: "gid"]
  }
}
