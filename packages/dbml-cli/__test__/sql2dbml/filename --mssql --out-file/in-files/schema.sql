CREATE TABLE [UserMaster] (
	[UserMasterKey] BIGINT IDENTITY (1, 1) NOT NULL
);

CREATE TABLE [CodeDef] (
    [CdKey]                     BIGINT             IDENTITY (1, 1) NOT NULL,
    [Category]                  NVARCHAR (50)      NOT NULL,
    [Description]               NVARCHAR (100)     NULL,
    [Code]                      NVARCHAR (50)      NOT NULL,
    [ParentCdKey]               BIGINT             NULL,
    [UserMasterKeyAddedBy]      BIGINT             NOT NULL,
    [UserMasterKeyLastEditedBy] BIGINT             NULL,
    [AddedDtTm]                 DATETIMEOFFSET (7) NOT NULL,
    [LastEditedDtTm]            DATETIMEOFFSET (7) NULL,
    [EffectiveFromDtTm]         DATETIMEOFFSET (7) NOT NULL,
    [EffectiveThruDtTm]         DATETIMEOFFSET (7) NULL,
    CONSTRAINT [PK__CodeDef__4922449ECDD244C3] PRIMARY KEY CLUSTERED ([CdKey] ASC),
    CONSTRAINT [fk__CodeDef__ParentCdKey__CodeDef__CdKey] FOREIGN KEY ([ParentCdKey]) REFERENCES [CodeDef] ([CdKey]),
    CONSTRAINT [fk__CodeDef__UserMasterKeyLastEditedBy__UserMaster_UserMasterKey] FOREIGN KEY ([UserMasterKeyLastEditedBy]) REFERENCES [UserMaster] ([UserMasterKey])
);