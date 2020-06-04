CREATE TABLE [users] (
  [id] int,
  [full_name] nvarchar(255),
  [email] nvarchar(255) UNIQUE,
  [gender] nvarchar(255),
  [date_of_birth] nvarchar(255),
  [created_at] nvarchar(255),
  [country_code] int,
  [active] boolean,
  PRIMARY KEY ([id], [full_name])
)
GO

CREATE UNIQUE INDEX [users_index_0] ON [users] ("id")
GO

CREATE INDEX [User Name] ON [users] ("full_name")
GO

CREATE INDEX [users_index_2] ON [users] ("email", "created_at")
GO