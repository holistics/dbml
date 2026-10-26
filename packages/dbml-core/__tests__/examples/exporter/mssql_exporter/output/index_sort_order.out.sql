CREATE TABLE [orders] (
  [id] integer PRIMARY KEY,
  [customer_id] integer,
  [status] nvarchar(255),
  [created_at] timestamp
)
GO

CREATE INDEX [orders_index_0] ON [orders] ("created_at" DESC)
GO

CREATE INDEX [orders_customer_recent] ON [orders] ("customer_id", "created_at" DESC)
GO

CREATE UNIQUE INDEX [orders_index_2] ON [orders] ("status" DESC, "id")
GO

CREATE INDEX [orders_index_3] ON [orders] ((lower(status)) DESC)
GO
