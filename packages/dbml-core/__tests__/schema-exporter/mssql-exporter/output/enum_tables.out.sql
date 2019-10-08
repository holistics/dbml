CREATE TABLE [jobs] (
  [id] integer PRIMARY KEY,
  [status] nvarchar(255) NOT NULL CHECK ([status] IN ('created', 'running', 'done', 'failed', 'wait for validation'))
)
GO

CREATE TABLE [orders] (
  [id] int PRIMARY KEY,
  [created_at] varchar(255),
  [priority] nvarchar(255) NOT NULL CHECK ([priority] IN ('low', 'medium', 'high')),
  [status] nvarchar(255) NOT NULL CHECK ([status] IN ('pending', 'processing', 'done'))
)
GO
