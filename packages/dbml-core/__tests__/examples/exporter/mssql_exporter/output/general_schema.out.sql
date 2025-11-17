CREATE TABLE [orders] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [user_id] int UNIQUE NOT NULL,
  [status] nvarchar(255) NOT NULL CHECK ([status] IN ('created', 'running', 'done', 'failure')),
  [created_at] varchar(255)
)
GO

CREATE TABLE [order_items] (
  [order_id] int,
  [product_id] int,
  [quantity] int DEFAULT (1)
)
GO

CREATE TABLE [products] (
  [id] int,
  [name] varchar(255),
  [merchant_id] int NOT NULL,
  [price] int,
  [status] nvarchar(255) NOT NULL CHECK ([status] IN ('Out of Stock', 'In Stock')),
  [created_at] datetime DEFAULT (now()),
  PRIMARY KEY ([id], [name])
)
GO

CREATE TABLE [users] (
  [id] int PRIMARY KEY,
  [full_name] varchar(255),
  [email] varchar(255) UNIQUE,
  [gender] varchar(255),
  [date_of_birth] varchar(255),
  [created_at] varchar(255),
  [country_code] int
)
GO

CREATE TABLE [merchants] (
  [id] int PRIMARY KEY,
  [merchant_name] varchar(255),
  [country_code] int,
  [created_at] varchar(255),
  [admin_id] int
)
GO

CREATE TABLE [countries] (
  [code] int PRIMARY KEY,
  [name] varchar(255),
  [continent_name] varchar(255)
)
GO

CREATE INDEX [product_status] ON [products] ("merchant_id", "status")
GO

CREATE UNIQUE INDEX [products_index_1] ON [products] ("id")
GO

EXEC sp_addextendedproperty
@name = N'Table_Description',
@value = 'This is a note in table "orders"',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'orders';
GO

EXEC sp_addextendedproperty
@name = N'Column_Description',
@value = 'When order created',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'orders',
@level2type = N'Column', @level2name = 'created_at';
GO

EXEC sp_addextendedproperty
@name = N'Table_Description',
@value = 'This is a note in table ''products''',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'products';
GO

EXEC sp_addextendedproperty
@name = N'Table_Description',
@value = 'This is a note in table "users"',
@level0type = N'Schema', @level0name = 'dbo',
@level1type = N'Table',  @level1name = 'users';
GO

ALTER TABLE [order_items] ADD FOREIGN KEY ([order_id]) REFERENCES [orders] ([id])
GO

ALTER TABLE [order_items] ADD FOREIGN KEY ([product_id]) REFERENCES [products] ([id])
GO

ALTER TABLE [users] ADD FOREIGN KEY ([country_code]) REFERENCES [countries] ([code])
GO

ALTER TABLE [merchants] ADD FOREIGN KEY ([country_code]) REFERENCES [countries] ([code])
GO

ALTER TABLE [products] ADD FOREIGN KEY ([merchant_id]) REFERENCES [merchants] ([id])
GO

ALTER TABLE [merchants] ADD FOREIGN KEY ([admin_id]) REFERENCES [users] ([id])
GO
