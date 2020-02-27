Enum "job_status" {
  "created"
  "running"
  "done"
  "failed"
  "wait for validation"
}

Enum "order_status" {
  "pending"
  "processing"
  "done"
}

Enum "priority enum" {
  "low"
  "medium"
  "high"
}

Table "jobs" {
  "id" integer [pk]
  "status" job_status
}

Table "orders" {
  "id" int [pk]
  "created_at" varchar
  "priority" "priority enum"
  "status" order_status
}
