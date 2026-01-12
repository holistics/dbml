# frozen_string_literal: true

# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `rails
# db:schema:load`. When creating a new database, `rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20_200_326_024_222) do
  # These are extensions that must be enabled in order to support this database
  enable_extension 'plpgsql'

create_table 'actions', id: :serial, force: :cascade do |t|
    t.string 'action_type', null: false
    t.string 'action_option'
    t.string 'target_type'
    t.integer 'target_id'
    t.string 'user_type'
    t.integer 'user_id'
    t.datetime 'created_at', null: false
    t.datetime 'updated_at', null: false
    t.index %w[action_type target_type target_id user_type user_id], name: 'uk_action_target_user', unique: true
    t.index %w[target_type target_id action_type], name: 'index_actions_on_target_type_and_target_id_and_action_type'
    t.index %w[user_type user_id action_type], name: 'index_actions_on_user_type_and_user_id_and_action_type'
  end

  create_table 'active_storage_attachments', force: :cascade do |t|
    t.string 'name', null: false
    t.string 'record_type', null: false
    t.bigint 'record_id', null: false
    t.bigint 'blob_id', null: false
    t.datetime 'created_at', null: false
    t.index ['blob_id'], name: 'index_active_storage_attachments_on_blob_id'
    t.index %w[record_type record_id name blob_id], name: 'index_active_storage_attachments_uniqueness', unique: true
  end

  create_table 'active_storage_blobs', force: :cascade do |t|
    t.string 'key', null: false
    t.string 'filename', null: false
    t.string 'content_type'
    t.text 'metadata'
    t.bigint 'byte_size', null: false
    t.string 'checksum', null: false
    t.datetime 'created_at', null: false
    t.index ['key'], name: 'index_active_storage_blobs_on_key', unique: true
  end
  add_foreign_key 'active_storage_attachments', 'active_storage_blobs', column: 'blob_id'
end
