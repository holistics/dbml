/**
 * Sample DBML Content
 *
 * Centralized management of sample DBML content for the playground.
 * This module encapsulates all sample content and provides a simple interface
 * for accessing different types of examples.
 *
 * Design Principles Applied:
 * - Information Hiding: Sample content details are hidden from consumers
 * - Single Responsibility: Only manages sample content
 * - General Purpose: Extensible for different content types
 */

/**
 * Default sample DBML content for the playground
 */
export const DEFAULT_SAMPLE_CONTENT = `Table users {
  id int [pk]
  username varchar [not null]
  email varchar [unique, not null]
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id int [pk]
  title varchar [not null]
  content text
  user_id int [ref: > users.id]
  created_at timestamp [default: \`now()\`]

  indexes {
    created_at
    (user_id, created_at)
  }
}

Enum post_status {
  draft
  published
  archived
}`

/**
 * Sample content categories
 */
export interface SampleCategory {
  readonly name: string
  readonly description: string
  readonly content: string
}

/**
 * Available sample content organized by category
 */
export const SAMPLE_CATEGORIES: readonly SampleCategory[] = [
  {
    name: 'Basic Example',
    description: 'Simple tables with relationships',
    content: DEFAULT_SAMPLE_CONTENT
  },
  {
    name: 'E-commerce Schema',
    description: 'Complete e-commerce database with users, products, and orders',
    content: `Project ecommerce_db {
  database_type: 'PostgreSQL'
  Note: 'E-commerce database schema'
}

Table users {
  id int [pk, increment]
  username varchar(50) [not null, unique]
  email varchar(255) [not null, unique]
  first_name varchar(100)
  last_name varchar(100)
  status user_status [default: 'active']
  created_at timestamp [default: \`now()\`]
}

Table products {
  id int [pk, increment]
  name varchar(255) [not null]
  description text
  price decimal(10,2) [not null]
  category_id int [ref: > categories.id]
  status product_status [default: 'active']
  created_at timestamp [default: \`now()\`]
}

Table categories {
  id int [pk, increment]
  name varchar(100) [not null, unique]
  description text
  parent_id int [ref: > categories.id]
}

Table orders {
  id int [pk, increment]
  user_id int [ref: > users.id, not null]
  status order_status [default: 'pending']
  total_amount decimal(10,2) [not null]
  created_at timestamp [default: \`now()\`]
}

Enum user_status {
  active
  inactive
  suspended
}

Enum product_status {
  active
  inactive
  discontinued
}

Enum order_status {
  pending
  confirmed
  shipped
  delivered
  cancelled
}`
  },
  {
    name: 'Syntax Errors',
    description: 'Example with intentional syntax errors for testing error handling',
    content: `Table users {
  id int [pk
  username varchar [not null]
  email varchar [unique]
  invalid_field missing_type
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id int [pk]
  title varchar [not null]
  user_id int [ref: > users.nonexistent_field]
  // Missing closing brace

Enum status {
  active
  inactive
  // Missing closing brace`
  }
] as const

/**
 * Get sample content by category name
 */
export function getSampleContent(categoryName: string): string | null {
  const category = SAMPLE_CATEGORIES.find(cat => cat.name === categoryName)
  return category?.content ?? null
}

/**
 * Get all available sample categories
 */
export function getSampleCategories(): readonly SampleCategory[] {
  return SAMPLE_CATEGORIES
}