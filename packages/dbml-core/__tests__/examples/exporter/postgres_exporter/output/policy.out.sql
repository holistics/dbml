CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "email" varchar
);

CREATE TABLE "posts" (
  "id" int PRIMARY KEY,
  "user_id" int,
  "title" varchar
);

CREATE POLICY "Users can view their own data" ON "public"."users"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own posts" ON "public"."posts"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated, admin
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read access" ON "public"."posts"
  AS PERMISSIVE
  FOR SELECT
  TO public;
