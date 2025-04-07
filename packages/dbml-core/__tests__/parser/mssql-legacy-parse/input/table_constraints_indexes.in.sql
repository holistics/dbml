CREATE TABLE [products] (
  [id] int PRIMARY KEY IDENTITY(1,1),
  [name] varchar(255),
  [price] decimal(10,4),
  [created_at] datetime DEFAULT (now())
);

CREATE TABLE [countries] (
  [country_code] int PRIMARY KEY,
  [name] varchar(255),
  [continent_name] varchar(255),
  INDEX [unique_continent] UNIQUE NONCLUSTERED ([continent_name])
);

CREATE TABLE [users] (
  [id] int PRIMARY KEY IDENTITY(1,1),
  [name] varchar(255),
  [email] varchar(255),
  [date_of_birth] datetime,
  [created_at] datetime DEFAULT (now()),
  [country_code] int NOT NULL,
  FOREIGN KEY ([country_code]) REFERENCES [countries] ON DELETE NO ACTION ON UPDATE NO ACTION,
  INDEX [unique_email_name] UNIQUE CLUSTERED ([email],[name])
);

CREATE TABLE [orders] (
  [id] int PRIMARY KEY IDENTITY(1,1),
  [user_id] int NOT NULL,
  [created_at] datetime DEFAULT (now()),
  FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON UPDATE NO ACTION ON DELETE SET NULL
);

CREATE TABLE [order_items] (
  [id] int PRIMARY KEY IDENTITY(1,1),
  [order_id] int NOT NULL,
  [product_id] int DEFAULT null,
  [quantity] int DEFAULT 1,
  FOREIGN KEY ([order_id]) REFERENCES [orders] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY ([product_id]) REFERENCES [products] ([id]) ON DELETE SET NULL
);
