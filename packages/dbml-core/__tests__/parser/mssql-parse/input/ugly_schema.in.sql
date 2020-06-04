


ENABLE something;


GO
CREATE TABLE [schema].[orders] AS FileTable (
  [id] int PRIMARY KEY CLUSTERED ON filegroup WITH FILLFACTOR = [fill]
   IDENTITY(1, 1) FILESTREAM COLLATE [collate],
  [user_id] int UNIQUE NOT NULL SPARSE MASKED WITH (FUNCTION = 'func()'),
  [status] nvarchar(255) NOT NULL CHECK ([status] IN ('created', 'running', 'done', 'failure')),
  [created_at] varchar(255) GENERATED ALWAYS AS ROW START HIDDEN ROWGUIDCOL
) ON [filegroup] TEXTIMAGE_ON "default" FILESTREAM_ON "default" 
    WITH (
        DATA_COMPRESSION = NONE,
        REMOTE_DATA_ARCHIVE = OFF (MIGRATION_STATE = PAUSED)
    );
/*==============================================================*/
/* MULTILINE-COMMENT                                            */
/*==============================================================*/
CREATE -- SINGLE LINE COMMENT
TABLE [order_items] (
  [order_id] int ENCRYPTED WITH (COLUMN_ENCRYPTION_KEY = [key]),
  [product_id] int CONSTRAINT [con_name] CHECK NOT FOR REPLICATION (1 > 2),
  [quantity] int DEFAULT (1) INDEX [index] CLUSTERED 
   WITH (PAD_INDEX = ON, DATA_COMPRESSION = ROW ON PARTITIONS ([par1],[par2])) ON default FILESTREAM_ON [filestream],
  [computed] AS FUNC() PERSISTED UNIQUE,
  [set] XML COLUMN_SET FOR ALL_SPARSE_COLUMNS,
  CONSTRAINT [tableConstraint] CHECK ( 2 > 1 ),
  INDEX [index_quantity] CLUSTERED ([product_id]) ON [something] FILESTREAM_ON [filestream],
  PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime)
);
GO
DROP something;
GO
INSERT something;
GO
ALTER 
TABLE [order_items] ADD FOREIGN KEY ([order_id]) REFERENCES [orders] ([id]);
ALTER TABLE [table] WITH sth;
ALTER TABLE [table] SET sth;
ALTER TABLE [table] SWITCH sth; 
CREATE UNIQUE INDEX [products_id] ON [order_items] ("id");
CREATE WRONGSYNTAX;
