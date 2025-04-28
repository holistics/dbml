-- simple
INSERT INTO users (id, name, email, created_at)
VALUES (1, 'Alice Johnson', 'alice@example.com', NOW());

-- simple bulk insert
INSERT INTO users (id, name, email, created_at)
VALUES
  (2, 'Bob Smith', 'bob@example.com', NOW()),
  (3, 'Charlie Davis', 'charlie@example.com', NOW());

INSERT INTO public.posts (id, title, content, author_id, published_at)
VALUES
  (1, 'Getting Started with PostgreSQL', 'This post covers the basics of PostgreSQL...', 1, NOW()),
  (2, 'Understanding Indexing in Databases', 'Indexes help speed up queries by...', 2, NOW()),
  (3, 'Best Practices for SQL Queries', 'Writing efficient SQL queries is crucial for...', 1, NOW());

INSERT INTO blog.posts (id, title, content, author_id, published_at)
VALUES
  (1, 'Getting Started with PostgreSQL', 'This post covers the basics of PostgreSQL...', 1, NOW()),
  (2, 'Understanding Indexing in Databases', 'Indexes help speed up queries by...', 2, NOW()),
  (3, 'Best Practices for SQL Queries', 'Writing efficient SQL queries is crucial for...', 1, NOW());

INSERT INTO store.products (id, name, details, tags, in_stock, price, created_at)
VALUES
  (1, 'Laptop', '{"brand": "Dell", "specs": {"ram": "16GB", "storage": "512GB SSD"}}'::json, ARRAY['electronics', 'computer'], TRUE, 1299.99, NOW()),
  (2, 'Smartphone', '{"brand": "Samsung", "specs": {"ram": "8GB", "storage": "256GB"}}'::json, ARRAY['electronics', 'mobile'], TRUE, 899.99, NOW()),
  (3, 'Headphones', '{"brand": "Sony", "specs": {"type": "Wireless", "battery_life": "30 hours"}}'::json, ARRAY['electronics', 'audio'], FALSE, 199.99, NOW());

INSERT INTO ignore_1.users
VALUES (1, 'Alice Johnson', 'alice@example.com', NOW());


INSERT INTO ignore_2.users (id, name, email, preferences, created_at)
SELECT
  id, name, email, preferences, NOW()
FROM app.new_users
WHERE email NOT IN (SELECT email FROM app.users)
ON CONFLICT (email)
DO UPDATE SET
  name = EXCLUDED.name,
  preferences = EXCLUDED.preferences,
  created_at = NOW();
