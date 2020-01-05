create_table "xero_users", id: :uuid, default: -> { "uuid_generate_v4()" }, force: :cascade do |t|
  t.string "email_address"
end
