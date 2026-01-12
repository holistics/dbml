CREATE TABLE [sample_table] (
  [status] VARCHAR(20) CHECK ([status] IN ('active', 'inactive', 'pending')),
  [email] VARCHAR(100) CHECK ([email] LIKE '%@%.%'),
  [user_type] VARCHAR(20) CHECK ([user_type] NOT IN ('banned', 'suspended'))
)
GO

CREATE SCHEMA myschema
GO

CREATE TABLE myschema.sample_table (
  status VARCHAR(20),
  email VARCHAR(100),
  user_type VARCHAR(20),

  CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'pending')),
)
GO

ALTER TABLE myschema.sample_table
  ADD CONSTRAINT chk_email
  CHECK (email LIKE '%@%.%')
GO

ALTER TABLE myschema.sample_table
  ADD CONSTRAINT chk_user_type
  CHECK (user_type NOT IN ('banned', 'suspended'))
GO
