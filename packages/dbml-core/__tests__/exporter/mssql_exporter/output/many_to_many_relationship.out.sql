CREATE SCHEMA [schemaA]
GO

CREATE SCHEMA [schemaB]
GO

CREATE TABLE [schemaA].[authors] (
  [id] int,
  [name] nvarchar(255),
  [dob] date,
  [gender] nvarchar(255),
  PRIMARY KEY ([id], [dob])
)
GO

CREATE TABLE [schemaB].[books] (
  [id] int,
  [release_date] date,
  [title] nvarchar(255),
  PRIMARY KEY ([id], [release_date])
)
GO

CREATE TABLE [authors_books] (
  [authors_id] int NOT NULL,
  [authors_dob] date NOT NULL,
  [books_id] int NOT NULL,
  [books_release_date] date NOT NULL,
  CONSTRAINT PK_authors_books PRIMARY KEY ([authors_id], [authors_dob], [books_id], [books_release_date])
);
GO

CREATE INDEX idx_authors_books_authors ON [authors_books] ("authors_id", "authors_dob");
GO

CREATE INDEX idx_authors_books_books ON [authors_books] ("books_id", "books_release_date");
GO

ALTER TABLE [authors_books] ADD FOREIGN KEY ([authors_id], [authors_dob]) REFERENCES [schemaA].[authors] ([id], [dob]);
GO

ALTER TABLE [authors_books] ADD FOREIGN KEY ([books_id], [books_release_date]) REFERENCES [schemaB].[books] ([id], [release_date]);
GO

