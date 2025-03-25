-- Simple insert
INSERT INTO users (id, name, email, created_at)
VALUES (1, 'Alice Johnson', 'alice@example.com', NOW());

-- Simple bulk insert
INSERT INTO users (id, name, email, created_at)
VALUES
  (2, 'Bob Smith', 'bob@example.com', NOW()),
  (3, 'Charlie Davis', 'charlie@example.com', NOW());

-- Insert into schema.table
INSERT INTO blog.posts (id, title, content, author_id, published_at)
VALUES
  (1, 'Getting Started with MySQL', 'This post covers the basics of MySQL...', 1, NOW()),
  (2, 'Understanding Indexing in Databases', 'Indexes help speed up queries by...', 2, NOW()),
  (3, 'Best Practices for SQL Queries', 'Writing efficient SQL queries is crucial for...', 1, NOW());

-- JSON and ARRAY handling
INSERT INTO store.products (id, name, details, tags, in_stock, price, created_at)
VALUES
  (1, 'Laptop', '{"brand": "Dell", "specs": {"ram": "16GB", "storage": "512GB SSD"}}', '["electronics", "computer"]', TRUE, 1299.99, NOW()),
  (2, 'Smartphone', '{"brand": "Samsung", "specs": {"ram": "8GB", "storage": "256GB"}}', '["electronics", "mobile"]', TRUE, 899.99, NOW()),
  (3, 'Headphones', '{"brand": "Sony", "specs": {"type": "Wireless", "battery_life": "30 hours"}}', '["electronics", "audio"]', FALSE, 199.99, NOW());

-- should ignore: no columns
INSERT INTO users
VALUES (1, 'Alice Johnson', 'alice@example.com', NOW());

-- Ignoring cases
INSERT INTO app.users (id, name, email, preferences, created_at)
SELECT id, name, email, preferences, NOW()
FROM app.new_users
WHERE email NOT IN (SELECT email FROM app.users)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  preferences = VALUES(preferences),
  created_at = NOW();
