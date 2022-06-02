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
  [a_AB] integer NOT NULL,
  [a_BA] integer NOT NULL,
  [b_BC] integer NOT NULL,
  [b_CB] integer NOT NULL,
  PRIMARY KEY ([a_AB], [a_BA], [b_BC], [b_CB])
);
GO

CREATE INDEX [idx_a_b_a] ON [a_b] ("a_AB", "a_BA");
GO

CREATE INDEX [idx_a_b_b] ON [a_b] ("b_BC", "b_CB");
GO

ALTER TABLE [a_b] ADD FOREIGN KEY ([a_AB], [a_BA]) REFERENCES [A].[a] ([AB], [BA]);
GO

ALTER TABLE [a_b] ADD FOREIGN KEY ([b_BC], [b_CB]) REFERENCES [B].[b] ([BC], [CB]);
GO


CREATE TABLE [d_c] (
  [d_DE] integer NOT NULL,
  [c_CD] integer NOT NULL,
  PRIMARY KEY ([d_DE], [c_CD])
);
GO

ALTER TABLE [d_c] ADD FOREIGN KEY ([d_DE]) REFERENCES [D].[d] ([DE]);
GO

ALTER TABLE [d_c] ADD FOREIGN KEY ([c_CD]) REFERENCES [C].[c] ([CD]);
GO


CREATE TABLE [e_g] (
  [e_EF] integer NOT NULL,
  [e_FE] integer NOT NULL,
  [g_GH] integer NOT NULL,
  [g_HG] integer NOT NULL,
  PRIMARY KEY ([e_EF], [e_FE], [g_GH], [g_HG])
);
GO

CREATE INDEX [idx_e_g_e] ON [e_g] ("e_EF", "e_FE");
GO

CREATE INDEX [idx_e_g_g] ON [e_g] ("g_GH", "g_HG");
GO

ALTER TABLE [e_g] ADD FOREIGN KEY ([e_EF], [e_FE]) REFERENCES [E].[e] ([EF], [FE]);
GO

ALTER TABLE [e_g] ADD FOREIGN KEY ([g_GH], [g_HG]) REFERENCES [G].[g] ([GH], [HG]);
GO


CREATE TABLE [t1_t2(1)] (
  [t1_a] int NOT NULL,
  [t2_a] int NOT NULL,
  PRIMARY KEY ([t1_a], [t2_a])
);
GO

ALTER TABLE [t1_t2(1)] ADD FOREIGN KEY ([t1_a]) REFERENCES [t1] ([a]);
GO

ALTER TABLE [t1_t2(1)] ADD FOREIGN KEY ([t2_a]) REFERENCES [t2] ([a]);
GO


CREATE TABLE [t1_t2(2)] (
  [t1_b] int NOT NULL,
  [t2_b] int NOT NULL,
  PRIMARY KEY ([t1_b], [t2_b])
);
GO

ALTER TABLE [t1_t2(2)] ADD FOREIGN KEY ([t1_b]) REFERENCES [t1] ([b]);
GO

ALTER TABLE [t1_t2(2)] ADD FOREIGN KEY ([t2_b]) REFERENCES [t2] ([b]);
GO

