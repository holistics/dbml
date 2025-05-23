CREATE TABLE [test] (
  [text1] varchar(255) DEFAULT 'Test',
  [text2] varchar(255) DEFAULT ('Test'),
  [text3] varchar(255) DEFAULT (('Test')),
  [text4] varchar(255) DEFAULT ((('Test'))),

  [number1] int DEFAULT 0,
  [number2] int DEFAULT (0),
  [number3] int DEFAULT ((0)),
  [number4] int DEFAULT (((0))),

  [date1] datetime DEFAULT GETDATE(),
  [date2] datetime DEFAULT (GETDATE()),
  [date3] datetime DEFAULT ((GETDATE())),
  [date4] datetime DEFAULT (((GETDATE())))
)

ALTER TABLE [test] ADD DEFAULT 'Test2' FOR [text1] WITH VALUES
ALTER TABLE [test] ADD DEFAULT ('Test2') FOR [text2] WITH VALUES
ALTER TABLE [test] ADD DEFAULT (('Test2')) FOR [text3] WITH VALUES
ALTER TABLE [test] ADD DEFAULT ((('Test2'))) FOR [text4] WITH VALUES

ALTER TABLE [test] ADD DEFAULT 1 FOR [number1] WITH VALUES
ALTER TABLE [test] ADD DEFAULT (1) FOR [number2] WITH VALUES
ALTER TABLE [test] ADD DEFAULT ((1)) FOR [number3] WITH VALUES
ALTER TABLE [test] ADD DEFAULT (((1))) FOR [number4] WITH VALUES

ALTER TABLE [test] ADD DEFAULT GETDATE() FOR [date1] WITH VALUES
ALTER TABLE [test] ADD DEFAULT (GETDATE()) FOR [date2] WITH VALUES
ALTER TABLE [test] ADD DEFAULT ((GETDATE())) FOR [date3] WITH VALUES
ALTER TABLE [test] ADD DEFAULT (((GETDATE()))) FOR [date4] WITH VALUES
GO
