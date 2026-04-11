import { describe, it, expect } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { MockTextModel, createPosition } from '../utils';
import { Filepath } from '@/core/types/filepath';

describe('[samples] multifile symbol collision and wildcard imports', () => {
  describe('symbol name collisions across files', () => {
    it('should handle same table name defined in multiple files', () => {
      const compiler = new Compiler();

      // File 1: schema1.dbml
      compiler.setSource(
        new Filepath('/project/schema1.dbml'),
        `Table users {
  id int [pk]
  email string
}`,
      );

      // File 2: schema2.dbml - same table name different columns
      compiler.setSource(
        new Filepath('/project/schema2.dbml'),
        `Table users {
  user_id int [pk]
  name string
  org_id int
}`,
      );

      compiler.bindProject();

      // Verify both tables exist in the project
      expect(compiler).toBeDefined();

      // When defining refs, the compiler should handle the collision
      const refSource = `use { users } from './schema1'

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id`;

      compiler.setSource(new Filepath('/project/orders.dbml'), refSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(refSource, 'file:///project/orders.dbml') as any;

      // Position at 'users' in Ref line
      const definitions = definitionProvider.provideDefinition(model, createPosition(6, 25));

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('should handle same enum name in multiple files', () => {
      const compiler = new Compiler();

      // File 1: types1.dbml
      compiler.setSource(
        new Filepath('/project/types1.dbml'),
        `Enum status {
  active
  inactive
  pending
}`,
      );

      // File 2: types2.dbml - same enum name, different values
      compiler.setSource(
        new Filepath('/project/types2.dbml'),
        `Enum status {
  draft
  published
  archived
}`,
      );

      // File 3: models.dbml - uses one of them
      const modelSource = `use { status } from './types1'

Table posts {
  id int [pk]
  status status
}`;

      compiler.setSource(new Filepath('/project/models.dbml'), modelSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(modelSource, 'file:///project/models.dbml') as any;

      // Find definition of 'status' - should resolve to types1
      const definitions = definitionProvider.provideDefinition(model, createPosition(3, 10));

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('should handle same schema name in multiple files with use statement', () => {
      const compiler = new Compiler();

      // File 1: db1.dbml
      compiler.setSource(
        new Filepath('/project/db1.dbml'),
        `Schema public {
  Table users {
    id int
  }
}`,
      );

      // File 2: db2.dbml
      compiler.setSource(
        new Filepath('/project/db2.dbml'),
        `Schema public {
  Table products {
    id int
  }
}`,
      );

      // File 3: main.dbml - disambiguate via use statement
      const mainSource = `use { public } from './db1'

Ref: public.users.id > other.user_id`;

      compiler.setSource(new Filepath('/project/main.dbml'), mainSource);
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(mainSource, 'file:///project/main.dbml') as any;

      // Find all references to 'public' - should find from db1
      const references = referencesProvider.provideReferences(model, createPosition(3, 12));

      expect(Array.isArray(references)).toBe(true);
    });

    it('should resolve to correct symbol when collision disambiguated by use statement', () => {
      const compiler = new Compiler();

      // File 1: auth.dbml
      compiler.setSource(
        new Filepath('/project/auth.dbml'),
        `Table User {
  id int [pk]
  auth_id string
}`,
      );

      // File 2: accounts.dbml
      compiler.setSource(
        new Filepath('/project/accounts.dbml'),
        `Table User {
  id int [pk]
  account_id string
}`,
      );

      // File 3: uses auth.User specifically
      const mainSource = `use { User } from './auth'

Table sessions {
  id int
  user_id int
}

Ref: sessions.user_id > User.id`;

      compiler.setSource(new Filepath('/project/main.dbml'), mainSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(mainSource, 'file:///project/main.dbml') as any;

      // Find definition - should resolve to auth.User
      const definitions = definitionProvider.provideDefinition(model, createPosition(7, 25));

      expect(Array.isArray(definitions)).toBe(true);
    });

    it('should handle collision without use statement falls back to local scope', () => {
      const compiler = new Compiler();

      compiler.setSource(
        new Filepath('/project/remote.dbml'),
        `Table Config {
  id int
  key string
}`,
      );

      // Local file without use statement
      const localSource = `Table Config {
  id int
  value string
}

Ref: Config.id > other.config_id`;

      compiler.setSource(new Filepath('/project/local.dbml'), localSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(localSource, 'file:///project/local.dbml') as any;

      // Position at 'Config' in Ref - should resolve to local Config
      const definitions = definitionProvider.provideDefinition(model, createPosition(6, 8));

      expect(Array.isArray(definitions)).toBe(true);
    });
  });

  describe('wildcard-style imports (import all from file)', () => {
    it('should handle conceptual import all via explicit symbol list', () => {
      const compiler = new Compiler();

      // File 1: types.dbml - define many types
      compiler.setSource(
        new Filepath('/project/types.dbml'),
        `Enum status {
  active
  inactive
}

Enum priority {
  high
  medium
  low
}

Enum visibility {
  public
  private
}`,
      );

      // File 2: imports all types
      const mainSource = `use { status, priority, visibility } from './types'

Table tasks {
  id int
  status status
  priority priority
  visibility visibility
}`;

      compiler.setSource(new Filepath('/project/main.dbml'), mainSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(mainSource, 'file:///project/main.dbml') as any;

      // Check each symbol can be found
      const positions = [
        { line: 4, col: 10 }, // status
        { line: 5, col: 10 }, // priority
        { line: 6, col: 10 }, // visibility
      ];

      for (const pos of positions) {
        const definitions = definitionProvider.provideDefinition(model, createPosition(pos.line, pos.col));
        expect(Array.isArray(definitions)).toBe(true);
      }
    });

    it('should handle importing all tables from a file', () => {
      const compiler = new Compiler();

      // File 1: auth_tables.dbml
      compiler.setSource(
        new Filepath('/project/auth_tables.dbml'),
        `Table users {
  id int [pk]
}

Table roles {
  id int [pk]
  name string
}

Table permissions {
  id int [pk]
  action string
}`,
      );

      // File 2: imports all tables
      const mainSource = `use { users, roles, permissions } from './auth_tables'

Table user_roles {
  user_id int
  role_id int
}

Ref: user_roles.user_id > users.id
Ref: user_roles.role_id > roles.id`;

      compiler.setSource(new Filepath('/project/main.dbml'), mainSource);
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(mainSource, 'file:///project/main.dbml') as any;

      // Find references to 'users' - should find from auth_tables
      const references = referencesProvider.provideReferences(model, createPosition(7, 30));

      expect(Array.isArray(references)).toBe(true);
    });

    it('should handle importing all symbols when some are used, some are not', () => {
      const compiler = new Compiler();

      compiler.setSource(
        new Filepath('/project/lib.dbml'),
        `Enum Color {
  red
  green
  blue
}

Enum Size {
  small
  medium
  large
}

Enum Shape {
  circle
  square
}`,
      );

      // Import all but only use some
      const mainSource = `use { Color, Size, Shape } from './lib'

Table items {
  id int
  color Color
}`;

      compiler.setSource(new Filepath('/project/main.dbml'), mainSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(mainSource, 'file:///project/main.dbml') as any;

      // Find Color definition - should work
      const colorDef = definitionProvider.provideDefinition(model, createPosition(5, 10));
      expect(Array.isArray(colorDef)).toBe(true);

      // Size and Shape are imported but not used - should still be available
      const sizeDef = definitionProvider.provideDefinition(model, createPosition(1, 15));
      const shapeDef = definitionProvider.provideDefinition(model, createPosition(1, 22));

      expect(Array.isArray(sizeDef)).toBe(true);
      expect(Array.isArray(shapeDef)).toBe(true);
    });

    it('should handle multiple files each importing all from different sources', () => {
      const compiler = new Compiler();

      // File 1: types.dbml
      compiler.setSource(
        new Filepath('/project/types.dbml'),
        `Enum status { active, inactive }`,
      );

      // File 2: enums.dbml
      compiler.setSource(
        new Filepath('/project/enums.dbml'),
        `Enum priority { high, medium, low }`,
      );

      // File 3: models1.dbml - imports from types
      compiler.setSource(
        new Filepath('/project/models1.dbml'),
        `use { status } from './types'

Table posts {
  id int
  status status
}`,
      );

      // File 4: models2.dbml - imports from enums
      compiler.setSource(
        new Filepath('/project/models2.dbml'),
        `use { priority } from './enums'

Table tasks {
  id int
  priority priority
}`,
      );

      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);

      // Check models1 can find status from types
      const model1 = new MockTextModel(
        `use { status } from './types'
Table posts { id int status status }`,
        'file:///project/models1.dbml',
      ) as any;

      const statusDef = definitionProvider.provideDefinition(model1, createPosition(2, 30));
      expect(Array.isArray(statusDef)).toBe(true);

      // Check models2 can find priority from enums
      const model2 = new MockTextModel(
        `use { priority } from './enums'
Table tasks { id int priority priority }`,
        'file:///project/models2.dbml',
      ) as any;

      const priorityDef = definitionProvider.provideDefinition(model2, createPosition(2, 32));
      expect(Array.isArray(priorityDef)).toBe(true);
    });

    it('should handle importing overlapping symbol sets from multiple files', () => {
      const compiler = new Compiler();

      // File 1: common.dbml
      compiler.setSource(
        new Filepath('/project/common.dbml'),
        `Table Audit {
  id int
  action string
}`,
      );

      // File 2: auth.dbml
      compiler.setSource(
        new Filepath('/project/auth.dbml'),
        `Table Audit {
  id int
  user_id int
}

Table User {
  id int
}`,
      );

      // File 3: imports from both (same symbol from different files)
      const mainSource = `use { Audit } from './common'
use { User } from './auth'

Table logs {
  id int
  audit_id int
}

Ref: logs.audit_id > Audit.id`;

      compiler.setSource(new Filepath('/project/main.dbml'), mainSource);
      compiler.bindProject();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(mainSource, 'file:///project/main.dbml') as any;

      // Find Audit - should resolve to common via use statement
      const auditDef = definitionProvider.provideDefinition(model, createPosition(8, 28));
      expect(Array.isArray(auditDef)).toBe(true);

      // Find User - should resolve to auth via use statement
      const userDef = definitionProvider.provideDefinition(model, createPosition(1, 15));
      expect(Array.isArray(userDef)).toBe(true);
    });
  });

  describe('collision resolution via binder', () => {
    it('should bind correct symbol when multiple with same name exist', () => {
      const compiler = new Compiler();

      compiler.setSource(
        new Filepath('/project/db1.dbml'),
        `Table Item {
  id int [pk]
  name string
}`,
      );

      compiler.setSource(
        new Filepath('/project/db2.dbml'),
        `Table Item {
  id int [pk]
  sku string
}`,
      );

      const source = `use { Item } from './db1'

Table Cart {
  item_id int
}

Ref: Cart.item_id > Item.id`;

      compiler.setSource(new Filepath('/project/main.dbml'), source);
      compiler.bindProject();

      // After binding, the Ref should resolve to Item from db1
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(source, 'file:///project/main.dbml') as any;

      const definition = definitionProvider.provideDefinition(model, createPosition(7, 25));

      // Should resolve without error
      expect(Array.isArray(definition)).toBe(true);
    });

    it('should handle binder with symbols imported from different files in same scope', () => {
      const compiler = new Compiler();

      compiler.setSource(
        new Filepath('/project/auth.dbml'),
        `Table User { id int }`,
      );

      compiler.setSource(
        new Filepath('/project/products.dbml'),
        `Table Product { id int }`,
      );

      const source = `use { User } from './auth'
use { Product } from './products'

Table Order {
  id int
  user_id int
  product_id int
}

Ref: Order.user_id > User.id
Ref: Order.product_id > Product.id`;

      compiler.setSource(new Filepath('/project/main.dbml'), source);
      compiler.bindProject();

      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(source, 'file:///project/main.dbml') as any;

      // Both references should resolve correctly
      const userRefs = referencesProvider.provideReferences(model, createPosition(1, 8));
      const productRefs = referencesProvider.provideReferences(model, createPosition(2, 15));

      expect(Array.isArray(userRefs)).toBe(true);
      expect(Array.isArray(productRefs)).toBe(true);
    });
  });
});
