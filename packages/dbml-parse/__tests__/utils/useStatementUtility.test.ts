import { describe, expect, it } from 'vitest';
import { UseStatementMerger } from '@/services/completion/utils/useStatementMerger';
import { Filepath } from '@/core/types/filepath';

describe('UseStatementMerger', () => {
  describe('scanExistingUses', () => {
    it('should parse single use statement', () => {
      const content = "use { User } from './models'";
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        startOffset: 0,
        endOffset: content.length,
        sourceFile: './models',
        importedSymbols: ['User'],
      });
    });

    it('should parse multiple symbols in single use statement', () => {
      const content = "use { User, Post, Comment } from './models'";
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      expect(results[0].importedSymbols).toEqual(['User', 'Post', 'Comment']);
    });

    it('should handle whitespace variations', () => {
      const content = "use  {  User  ,  Post  }  from  './models'";
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      expect(results[0].importedSymbols).toEqual(['User', 'Post']);
    });

    it('should parse double-quoted source path', () => {
      const content = 'use { User } from "./models"';
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      expect(results[0].sourceFile).toBe('./models');
    });

    it('should find multiple use statements', () => {
      const content = `use { User } from './models'
use { Table } from './schema'
use { Helper } from './utils'`;

      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(3);
      expect(results[0].sourceFile).toBe('./models');
      expect(results[1].sourceFile).toBe('./schema');
      expect(results[2].sourceFile).toBe('./utils');
    });

    it('should return empty array if no use statements', () => {
      const content = 'Table users { id int }';
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toEqual([]);
    });

    it('should ignore malformed use statements', () => {
      const content = 'use { User } from "./valid"\ninvalid use statement';
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      expect(results[0].sourceFile).toBe('./valid');
    });

    it('should calculate correct offsets', () => {
      const content = 'some text before use { User } from "./models" and after';
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      const { startOffset, endOffset } = results[0];
      expect(content.slice(startOffset, endOffset)).toBe('use { User } from "./models"');
    });

    it('should handle trailing commas in imports', () => {
      const content = 'use { User, Post, } from "./models"';
      const results = UseStatementMerger.scanExistingUses(content);

      expect(results).toHaveLength(1);
      // The regex will capture "User, Post, " which splits to ['User', 'Post', '']
      // filter(s => s.length > 0) removes empty strings
      expect(results[0].importedSymbols).toEqual(['User', 'Post']);
    });
  });

  describe('mergeSymbolIntoUses', () => {
    it('should add symbol to existing use statement', () => {
      const content = "use { User } from './models'";
      const filepath = new Filepath('/project/models.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Post', filepath);

      expect(result.newContent).toContain('User, Post');
      expect(result.newContent).toContain("from './models'");
      expect(result.hint).toBe('merged into existing');
    });

    it('should not add duplicate symbols', () => {
      const content = "use { User, Post } from './models'";
      const filepath = new Filepath('/project/models.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'User', filepath);

      expect(result.newContent).toBe(content);
      expect(result.hint).toBe('symbol already imported');
    });

    it('should create new use statement when source not found', () => {
      const content = "use { User } from './oldModels'";
      const filepath = new Filepath('/project/newModels.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Table', filepath);

      expect(result.newContent).toContain("use { Table } from './newModels'");
      expect(result.newContent).toContain("use { User } from './oldModels'");
      expect(result.hint).toBe('created new');
    });

    it('should prepend new use statement at top of file', () => {
      const content = "use { User } from './models'\n\nTable users { id int }";
      const filepath = new Filepath('/project/newModels.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Schema', filepath);

      expect(result.newContent).toMatch(/^use { Schema } from '\.\/newModels'/);
      expect(result.editStartOffset).toBe(0);
    });

    it('should handle empty file', () => {
      const content = '';
      const filepath = new Filepath('/project/models.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'User', filepath);

      expect(result.newContent).toContain("use { User } from './models'");
      expect(result.hint).toBe('created new');
    });

    it('should preserve content after use statement', () => {
      const content = "use { User } from './models'\n\nTable users { id int }";
      const filepath = new Filepath('/project/models.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Post', filepath);

      expect(result.newContent).toContain('Table users { id int }');
    });

    it('should normalize source path from Filepath', () => {
      // /project/dir/models.dbml -> ./models
      const filepath = new Filepath('/home/user/project/src/models.dbml');
      const content = '';
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'User', filepath);

      expect(result.newContent).toContain("from './models'");
    });

    it('should calculate correct edit offsets for merged statement', () => {
      const content = "use { User } from './models'";
      const filepath = new Filepath('/project/models.dbml');
      const originalLength = content.length;

      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Post', filepath);

      expect(result.editStartOffset).toBe(0);
      expect(result.editEndOffset).toBeGreaterThan(originalLength);
      expect(result.newContent.slice(result.editStartOffset, result.editEndOffset)).toContain('Post');
    });

    it('should preserve formatting of merged symbols', () => {
      const content = "use { User, Post } from './models'";
      const filepath = new Filepath('/project/models.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Comment', filepath);

      // Should have proper comma spacing
      expect(result.newContent).toMatch(/User, Post, Comment/);
    });

    it('should handle multiple use statements and merge into correct one', () => {
      const content = `use { User } from './models'
use { Table } from './schema'`;

      const filepath = new Filepath('/project/models.dbml');
      const result = UseStatementMerger.mergeSymbolIntoUses(content, 'Post', filepath);

      // Should add to models import, not schema
      expect(result.newContent).toContain('User, Post');
      expect(result.newContent).toContain('Table');
      expect(result.hint).toBe('merged into existing');
    });
  });
});
