INSERT INTO [Production].[UnitMeasure] (Name, UnitMeasureCode, ModifiedDate)
VALUES (N'Square Yards', N'Y2', GETDATE());
-- Insert with special characters in values
INSERT INTO "special_chars" (id, name, value)
VALUES
  (1, 'Special 1', 'test''s value'),
  (2, 'Special 2', 'value with "quotes"'),
  (3, 'Special 3', 'value with [brackets]');

-- Insert with complex expressions
INSERT INTO "complex_table" (id, name, value, created_at)
VALUES
  (1, 'Complex 1', ABS(-100) * 2 + 3, GETDATE()),
  (2, 'Complex 2', CAST(123 AS VARCHAR(10)) + 'test', CURRENT_TIMESTAMP),
  (3, 'Complex 3', NULLIF(1, 1), GETDATE());

INSERT INTO [Production].[UnitMeasure]
VALUES (N'FT', N'Feet', '20080414');

--  Inserting data into a table with an identity column
IF OBJECT_ID ('dbo.T1', 'U') IS NOT NULL
  DROP TABLE dbo.T1;
GO
CREATE TABLE dbo.T1 ( column_1 int IDENTITY, column_2 VARCHAR(30));
GO
GO
SET IDENTITY_INSERT T1 ON;
INSERT T1 (column_1, column_2) VALUES (1, 'Row #1');
GO
INSERT INTO T1 (column_1,column_2)
  VALUES (1, 'Explicit identity value'),
          (2, 'Explicit identity value');
GO
SELECT column_1, column_2
FROM T1;
GO
