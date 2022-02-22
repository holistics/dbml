CREATE SCHEMA [schemaB]
GO

CREATE SCHEMA [ecommerce]
GO

CREATE SCHEMA [schemaA]
GO

CREATE TABLE [users] (
  [id] int PRIMARY KEY,
  [name] nvarchar(255),
  [pjs] nvarchar(255) NOT NULL CHECK ([pjs] IN ('created2', 'running2', 'done2', 'failure2')),
  [pjs2] nvarchar(255) NOT NULL CHECK ([pjs2] IN ('created2', 'running2', 'done2', 'failure2')),
  [pg] nvarchar(255) NOT NULL CHECK ([pg] IN ('male', 'female')),
  [pg2] nvarchar(255) NOT NULL CHECK ([pg2] IN ('male2', 'female2'))
)
GO

CREATE TABLE [products] (
  [id] int PRIMARY KEY,
  [name] nvarchar(255)
)
GO

CREATE TABLE [ecommerce].[users] (
  [id] int PRIMARY KEY,
  [name] nvarchar(255),
  [ejs] nvarchar(255) NOT NULL CHECK ([ejs] IN ('created2', 'running2', 'done2', 'failure2')),
  [ejs2] nvarchar(255) NOT NULL CHECK ([ejs2] IN ('created2', 'running2', 'done2', 'failure2')),
  [eg] nvarchar(255) NOT NULL CHECK ([eg] IN ('male', 'female')),
  [eg2] nvarchar(255) NOT NULL CHECK ([eg2] IN ('male2', 'female2'))
)
GO

CREATE TABLE [schemaA].[products] (
  [id] int PRIMARY KEY,
  [name] nvarchar(255),
  [created_at] varchar(255),
  [lid] int FOREIGN KEY REFERENCES [schemaA].[locations]([id]),
  [lid2] int,
  CONSTRAINT FK_1
    FOREIGN KEY (lid2)
    REFERENCES schemaA.locations (id),
  INDEX [unique_lid_lid2] UNIQUE CLUSTERED ([lid],[lid2])
)
GO

CREATE TABLE [schemaA].[locations] (
  [id] int PRIMARY KEY,
  [name] nvarchar(255)

)

ALTER TABLE [ecommerce].[users] ADD FOREIGN KEY ([id]) REFERENCES [users] ([id])
GO

ALTER TABLE [ecommerce].[users] ADD CONSTRAINT [name_optional] FOREIGN KEY ([id]) REFERENCES [users] ([name])
GO

ALTER TABLE [schemaA].[products] ADD FOREIGN KEY ([name]) REFERENCES [ecommerce].[users] ([id])
GO

ALTER TABLE [schemaA].[locations] ADD FOREIGN KEY ([name]) REFERENCES [users] ([id])
GO

CREATE INDEX [idx_1] ON [ecommerce].[users] ("name", "ejs")
GO

ALTER TABLE [schemaA].[products] ADD DEFAULT now() FOR [created_at] WITH VALUES
GO
