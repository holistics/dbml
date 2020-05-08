CREATE TABLE [orders] (
  [id] int,
  [cool_id] int,
  [user_id] int UNIQUE NOT NULL,
  [status] orders_status_enum,
  [created_at] varchar(255),
  PRIMARY KEY ([id], [cool_id])
)
GO

CREATE TABLE [order_items] (
  [order_id] int,
  [cool_order_id] int,
  [product_id] int,
  [quantity] int DEFAULT (1)
)
GO

CREATE TABLE [products] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [name] varchar(255),
  [price] decimal(10,4),
  [created_at] datetime DEFAULT (now())
)
GO

CREATE TABLE [users] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [name] varchar(255),
  [email] varchar(255) UNIQUE,
  [date_of_birth] datetime,
  [created_at] datetime DEFAULT (now()),
  [country_code] int NOT NULL
)
GO

CREATE TABLE [countries] (
  [code] int PRIMARY KEY,
  [name] varchar(255),
  [continent_name] varchar(255)
)
GO

ALTER TABLE [orders] ADD FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON DELETE RESTRICT
GO

ALTER TABLE [order_items] ADD FOREIGN KEY ([order_id], [cool_order_id]) REFERENCES [orders] ([id], [cool_id]) ON DELETE CASCADE
GO

ALTER TABLE [order_items] ADD FOREIGN KEY ([product_id]) REFERENCES [products] ([id]) ON DELETE SET NULL
GO

ALTER TABLE [users] ADD FOREIGN KEY ([country_code]) REFERENCES [countries] ([code]) ON DELETE NO ACTION
GO

