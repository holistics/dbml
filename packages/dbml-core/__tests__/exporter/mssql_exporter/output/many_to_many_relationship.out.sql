CREATE SCHEMA [A]
GO

CREATE SCHEMA [B]
GO

CREATE SCHEMA [C]
GO

CREATE SCHEMA [D]
GO

CREATE SCHEMA [E]
GO

CREATE SCHEMA [G]
GO

CREATE TABLE [A].[a] (
  [AB] integer,
  [BA] integer,
  PRIMARY KEY ([AB], [BA])
)
GO

CREATE TABLE [B].[b] (
  [BC] integer,
  [CB] integer,
  PRIMARY KEY ([BC], [CB])
)
GO

CREATE TABLE [C].[c] (
  [CD] integer PRIMARY KEY,
  [DC] integer
)
GO

CREATE TABLE [D].[d] (
  [DE] integer PRIMARY KEY,
  [ED] integer
)
GO

CREATE TABLE [E].[e] (
  [EF] integer,
  [FE] integer,
  [DE] integer,
  [ED] integer,
  PRIMARY KEY ([EF], [FE])
)
GO

CREATE TABLE [G].[g] (
  [GH] integer,
  [HG] integer,
  [EH] integer,
  [HE] integer,
  PRIMARY KEY ([GH], [HG])
)
GO

CREATE TABLE [t1] (
  [a] int,
  [b] int
)
GO

CREATE TABLE [t2] (
  [a] int,
  [b] int
)
GO

CREATE TABLE [t1_t2] (
  [a] int
)
GO

CREATE TABLE [a_b] (
  [a_AB] integer,
  [a_BA] integer,
  [b_BC] integer,
  [b_CB] integer,
  PRIMARY KEY ([a_AB], [a_BA], [b_BC], [b_CB])
);
GO

ALTER TABLE [a_b] ADD FOREIGN KEY ([a_AB], [a_BA]) REFERENCES [A].[a] ([AB], [BA]);
GO

ALTER TABLE [a_b] ADD FOREIGN KEY ([b_BC], [b_CB]) REFERENCES [B].[b] ([BC], [CB]);
GO


CREATE TABLE [d_c] (
  [d_DE] integer,
  [c_CD] integer,
  PRIMARY KEY ([d_DE], [c_CD])
);
GO

ALTER TABLE [d_c] ADD FOREIGN KEY ([d_DE]) REFERENCES [D].[d] ([DE]);
GO

ALTER TABLE [d_c] ADD FOREIGN KEY ([c_CD]) REFERENCES [C].[c] ([CD]);
GO


CREATE TABLE [e_g] (
  [e_EF] integer,
  [e_FE] integer,
  [g_GH] integer,
  [g_HG] integer,
  PRIMARY KEY ([e_EF], [e_FE], [g_GH], [g_HG])
);
GO

ALTER TABLE [e_g] ADD FOREIGN KEY ([e_EF], [e_FE]) REFERENCES [E].[e] ([EF], [FE]);
GO

ALTER TABLE [e_g] ADD FOREIGN KEY ([g_GH], [g_HG]) REFERENCES [G].[g] ([GH], [HG]);
GO


CREATE TABLE [t1_t2(1)] (
  [t1_a] int,
  [t2_a] int,
  PRIMARY KEY ([t1_a], [t2_a])
);
GO

ALTER TABLE [t1_t2(1)] ADD FOREIGN KEY ([t1_a]) REFERENCES [t1] ([a]);
GO

ALTER TABLE [t1_t2(1)] ADD FOREIGN KEY ([t2_a]) REFERENCES [t2] ([a]);
GO


CREATE TABLE [t1_t2(2)] (
  [t1_b] int,
  [t2_b] int,
  PRIMARY KEY ([t1_b], [t2_b])
);
GO

ALTER TABLE [t1_t2(2)] ADD FOREIGN KEY ([t1_b]) REFERENCES [t1] ([b]);
GO

ALTER TABLE [t1_t2(2)] ADD FOREIGN KEY ([t2_b]) REFERENCES [t2] ([b]);
GO

