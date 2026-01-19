import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] FK in table partials', () => {
  test('should validate FK from injected table partial', () => {
    const source = `
      TablePartial fk_partial {
        user_id int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~fk_partial
      }

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }

      records posts(id, title, user_id) {
        1, "Post 1", 1
        2, "Post 2", 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation from injected table partial', () => {
    const source = `
      TablePartial fk_partial {
        user_id int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~fk_partial
      }

      records users(id, name) {
        1, "Alice"
      }

      records posts(id, title, user_id) {
        1, "Post 1", 1
        2, "Post 2", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 999 does not exist in users.id');
  });

  test('should validate FK when partial injected into multiple tables', () => {
    const source = `
      TablePartial timestamps {
        created_by int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~timestamps
      }

      Table comments {
        id int [pk]
        content varchar
        ~timestamps
      }

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }

      records posts(id, title, created_by) {
        1, "Post 1", 1
        2, "Post 2", 2
      }

      records comments(id, content, created_by) {
        1, "Comment 1", 1
        2, "Comment 2", 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation in one table when partial injected into multiple tables', () => {
    const source = `
      TablePartial timestamps {
        created_by int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~timestamps
      }

      Table comments {
        id int [pk]
        content varchar
        ~timestamps
      }

      records users(id, name) {
        1, "Alice"
      }

      records posts(id, title, created_by) {
        1, "Post 1", 1
      }

      records comments(id, content, created_by) {
        1, "Comment 1", 1
        2, "Comment 2", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: comments.created_by = 999 does not exist in users.id');
  });

  test('should allow NULL FK values from injected table partial', () => {
    const source = `
      TablePartial optional_user {
        user_id int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~optional_user
      }

      records users(id, name) {
        1, "Alice"
      }

      records posts(id, title, user_id) {
        1, "Post 1", 1
        2, "Anonymous Post", null
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should validate FK with multiple partials injected', () => {
    const source = `
      TablePartial user_ref {
        user_id int [ref: > users.id]
      }

      TablePartial category_ref {
        category_id int [ref: > categories.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table categories {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~user_ref
        ~category_ref
      }

      records users(id, name) {
        1, "Alice"
      }

      records categories(id, name) {
        1, "Tech"
      }

      records posts(id, title, user_id, category_id) {
        1, "Post 1", 1, 1
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation with multiple partials injected', () => {
    const source = `
      TablePartial user_ref {
        user_id int [ref: > users.id]
      }

      TablePartial category_ref {
        category_id int [ref: > categories.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table categories {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~user_ref
        ~category_ref
      }

      records users(id, name) {
        1, "Alice"
      }

      records categories(id, name) {
        1, "Tech"
      }

      records posts(id, title, user_id, category_id) {
        1, "Valid Post", 1, 1
        2, "Invalid Category", 1, 999
        3, "Invalid User", 999, 1
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    // Verify both errors are FK violations
    const errorMessages = warnings.map((e) => e.diagnostic);
    expect(errorMessages.every((msg) => msg.startsWith('FK violation'))).toBe(true);
  });

  test('should validate self-referencing FK from injected table partial', () => {
    const source = `
      TablePartial hierarchical {
        parent_id int [ref: > nodes.id]
      }

      Table nodes {
        id int [pk]
        name varchar
        ~hierarchical
      }

      records nodes(id, name, parent_id) {
        1, "Root", null
        2, "Child 1", 1
        3, "Child 2", 1
        4, "Grandchild", 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect self-referencing FK violation from injected table partial', () => {
    const source = `
      TablePartial hierarchical {
        parent_id int [ref: > nodes.id]
      }

      Table nodes {
        id int [pk]
        name varchar
        ~hierarchical
      }

      records nodes(id, name, parent_id) {
        1, "Root", null
        2, "Invalid Child", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: nodes.parent_id = 999 does not exist in nodes.id');
  });
});
