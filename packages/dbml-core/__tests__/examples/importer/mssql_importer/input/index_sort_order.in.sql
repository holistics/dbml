CREATE TABLE [orders] (
  [id] int,
  [customer_id] int,
  [status] nvarchar(20),
  [created_at] datetime,
  CONSTRAINT [PK_orders] PRIMARY KEY ([id] DESC),
  INDEX [orders_customer_recent] ([customer_id], [created_at] DESC)
)
GO

CREATE INDEX [orders_created] ON [orders] ([created_at] DESC)
GO

CREATE UNIQUE INDEX [orders_status_id] ON [orders] ([status] DESC, [id] ASC)
GO
