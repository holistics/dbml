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

ALTER TABLE [posts] ADD FOREIGN KEY ([user_id]) REFERENCES [users] ([id])
GO

-- Disable constraint checks for tables with data
ALTER TABLE [users] NOCHECK CONSTRAINT ALL;
GO
ALTER TABLE [posts] NOCHECK CONSTRAINT ALL;
GO

INSERT INTO [users] ([id], [name], [email], [active], [created_at])
VALUES
  (1, 'Alice', 'alice@example.com', 1, '2024-01-15T10:30:00+07:00'),
  (2, 'Bob', 'bob@example.com', 0, '2024-01-16T14:20:00+07:00'),
  (3, 'Charlie', NULL, 1, '2024-01-17T09:15:00+07:00');
GO
INSERT INTO [posts] ([id], [user_id], [title], [content])
VALUES
  (1, 1, 'First Post', 'Hello World'),
  (2, 1, 'Second Post', 'It''s a beautiful day');
GO

-- Re-enable constraint checks
ALTER TABLE [users] WITH CHECK CHECK CONSTRAINT ALL;
GO
ALTER TABLE [posts] WITH CHECK CHECK CONSTRAINT ALL;
GO
