CREATE TABLE [orders] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [user_id] int NOT NULL,
  [created_at] datetime DEFAULT (GETDATE())
)
GO

CREATE TABLE [order_items] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [order_id] int NOT NULL,
  [product_id] int DEFAULT (null),
  [quantity] int DEFAULT (1)
)
GO

CREATE TABLE [products] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [name] nvarchar(255),
  [price] decimal(10,4),
  [created_at] datetime DEFAULT (GETDATE())
)
GO

CREATE TABLE [users] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [name] nvarchar(255),
  [email] nvarchar(255) UNIQUE,
  [date_of_birth] datetime,
  [created_at] datetime DEFAULT (GETDATE()),
  [country_code] int NOT NULL
)
GO

CREATE TABLE [countries] (
  [code] int PRIMARY KEY,
  [name] nvarchar(255),
  [continent_name] nvarchar(255)
)
GO

ALTER TABLE [orders] ADD FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON DELETE RESTRICT
GO

ALTER TABLE [order_items] ADD FOREIGN KEY ([order_id]) REFERENCES [orders] ([id]) ON DELETE CASCADE
GO

ALTER TABLE [order_items] ADD FOREIGN KEY ([product_id]) REFERENCES [products] ([id]) ON DELETE SET NULL
GO

ALTER TABLE [users] ADD FOREIGN KEY ([country_code]) REFERENCES [countries] ([code]) ON DELETE NO ACTION
GO
