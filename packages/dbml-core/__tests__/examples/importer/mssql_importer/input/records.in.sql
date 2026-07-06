CREATE TABLE [products] (
  [id] integer PRIMARY KEY,
  [name] nvarchar(255),
  [price] decimal(10, 2),
  [in_stock] bit
);

-- First INSERT statement
INSERT INTO [products] ([id], [name], [price], [in_stock])
VALUES
  (1, 'Laptop', 999.99, 1),
  (2, 'Mouse', 29.99, 1);
GO

-- Second INSERT statement for the same table
INSERT INTO [products] ([id], [name], [price], [in_stock])
VALUES
  (3, 'Keyboard', 79.99, 0);
GO

-- Third INSERT statement with different column order
INSERT INTO [products] ([price], [in_stock], [id], [name])
VALUES
  (149.99, 1, 4, 'Monitor');
GO

CREATE TABLE [orders] (
  [id] integer PRIMARY KEY,
  [product_id] integer,
  [quantity] integer
);

-- Multiple INSERT statements for orders table
INSERT INTO [orders] ([id], [product_id], [quantity])
VALUES
  (1, 1, 2);
GO

INSERT INTO [orders] ([id], [product_id], [quantity])
VALUES
  (2, 2, 5),
  (3, 1, 1);
GO
