CREATE TABLE [orders] (
  [id] int PRIMARY KEY IDENTITY(1, 1),
  [user_id] int UNIQUE NOT NULL 
    CONSTRAINT fk_order_user FOREIGN KEY REFERENCES [users] ([id]) 
    ON DELETE NO ACTION,
  [status] orders_status_enum,
  [created_at] varchar(255)
)
GO

CREATE TABLE [order_items] (
  [order_id] int FOREIGN KEY REFERENCES [orders] ([id]) ON DELETE CASCADE,
  [product_id] int REFERENCES [products] ([id]) ON DELETE SET NULL,
  [product_name] varchar(255),
  [quantity] int DEFAULT (1)
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

CREATE TABLE [products] (
  [id] int,
  [name] varchar(255),
  [price] decimal(10,4),
  [created_at] datetime DEFAULT (now()),
  PRIMARY KEY ([id], [name])
)
GO