CREATE TABLE [users] (
  [id] int PRIMARY KEY,
  [name] varchar(255)
)
GO

CREATE TABLE [orders] (
  [id] int PRIMARY KEY,
  [user_id] int
)
GO

CREATE TABLE [audit_logs] (
  [id] int PRIMARY KEY,
  [order_id] int
)
GO

ALTER TABLE [orders] WITH CHECK ADD CONSTRAINT [FK_orders_users] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON DELETE CASCADE ON UPDATE SET NULL
GO

ALTER TABLE [audit_logs] WITH NOCHECK ADD CONSTRAINT [FK_audit_logs_orders] FOREIGN KEY ([order_id]) REFERENCES [orders] ([id])
GO
