CREATE TABLE [users] (
  [id] integer PRIMARY KEY,
  [name] nvarchar(255),
  [email] nvarchar(255),
  [active] boolean,
  [created_at] timestamp
)
GO

CREATE TABLE [posts] (
  [id] integer PRIMARY KEY,
  [user_id] integer,
  [title] nvarchar(255),
  [content] text
)
GO

ALTER TABLE [users] ADD FOREIGN KEY ([id]) REFERENCES [posts] ([user_id])
GO

-- Disable constraint checks for INSERT
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";
GO

INSERT INTO [users] ([id], [name], [email], [active], [created_at])
VALUES
  (1, 'Alice', 'alice@example.com', 1, '2024-01-15 10:30:00'),
  (2, 'Bob', 'bob@example.com', 0, '2024-01-16 14:20:00'),
  (3, 'Charlie', NULL, 1, '2024-01-17 09:15:00');
GO
INSERT INTO [posts] ([id], [user_id], [title], [content])
VALUES
  (1, 1, 'First Post', 'Hello World'),
  (2, 1, 'Second Post', 'It''s a beautiful day');
GO

-- Re-enable constraint checks
EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";
GO