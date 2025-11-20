Table "sample_table" {
  "status" VARCHAR(20) [check: `[status] IN ('active', 'inactive', 'pending')`]
  "email" VARCHAR(100) [check: `[email] LIKE '%@%.%'`]
  "user_type" VARCHAR(20) [check: `[user_type] NOT IN ('banned', 'suspended')`]
}

Table "myschema"."sample_table" {
  "status" VARCHAR(20)
  "email" VARCHAR(100)
  "user_type" VARCHAR(20)

  Checks {
    `status IN ('active', 'inactive', 'pending')` [name: 'chk_status']
    `email LIKE '%@%.%'` [name: 'chk_email']
    `user_type NOT IN ('banned', 'suspended')` [name: 'chk_user_type']
  }
}
