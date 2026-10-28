import { describe, expect, it } from 'vitest';
import { Filepath } from '@/core/types/filepath';

describe('Filepath', () => {
  describe('construction and normalization', () => {
    describe('Linux/Mac paths', () => {
      it('accepts absolute unix path', () => {
        const filepath = Filepath.from('/home/user/project/main.dbml');
        expect(filepath.absolute).toBe('/home/user/project/main.dbml');
      });

      it('accepts root path', () => {
        const filepath = Filepath.from('/');
        expect(filepath.absolute).toBe('/');
      });

      it('normalizes redundant slashes', () => {
        const filepath = Filepath.from('/home//user///project/main.dbml');
        expect(filepath.absolute).toBe('/home/user/project/main.dbml');
      });

      it('normalizes . and .. segments', () => {
        const filepath = Filepath.from('/home/user/./project/../project/main.dbml');
        expect(filepath.absolute).toBe('/home/user/project/main.dbml');
      });

      it('rejects relative path', () => {
        expect(() => Filepath.from('relative/path.dbml')).toThrow();
        expect(() => Filepath.from('./relative/path.dbml')).toThrow();
        expect(() => Filepath.from('../relative/path.dbml')).toThrow();
      });
    });

    describe('Windows paths', () => {
      it('accepts C:/ drive path', () => {
        const filepath = Filepath.from('C:/Users/project/main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });

      it('accepts lowercase drive letter (pathe normalizes to uppercase)', () => {
        const filepath = Filepath.from('c:/Users/project/main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });

      it('accepts C:\\ backslash path', () => {
        const filepath = Filepath.from('C:\\Users\\project\\main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });

      it('accepts mixed slash/backslash', () => {
        const filepath = Filepath.from('C:\\Users/project\\main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });

      it('normalizes . and .. in Windows paths', () => {
        const filepath = Filepath.from('C:/Users/./project/../project/main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });
    });

    describe('paths with special characters', () => {
      it('handles spaces in path', () => {
        const filepath = Filepath.from('/home/user/my project/main.dbml');
        expect(filepath.fsPath).toBe('/home/user/my project/main.dbml');
      });

      it('treats percent-encoded input as literal characters in from()', () => {
        // Filepath.from() receives filesystem paths, not URIs
        // %20 is treated as literal characters, not decoded
        const filepath = Filepath.from('/home/user/my%20project/main.dbml');
        expect(filepath.absolute).toBe('/home/user/my%20project/main.dbml');
      });

      it('decodes percent-encoded input in fromUri()', () => {
        // fromUri() is the URI entry point, URL API decodes
        const filepath = Filepath.fromUri('file:///home/user/my%20project/main.dbml');
        expect(filepath.absolute).toBe('/home/user/my project/main.dbml');
      });

      it('handles unicode characters', () => {
        const filepath = Filepath.from('/home/user/日本語/main.dbml');
        expect(filepath.absolute).toBe('/home/user/日本語/main.dbml');
      });
    });
  });

  describe('fromUri', () => {
    describe('file:// protocol', () => {
      it('parses file:///unix/path', () => {
        const filepath = Filepath.fromUri('file:///home/user/main.dbml');
        expect(filepath.absolute).toBe('/home/user/main.dbml');
      });

      it('parses file:///C:/windows/path', () => {
        const filepath = Filepath.fromUri('file:///C:/Users/project/main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });

      it('handles encoded spaces in URI', () => {
        const filepath = Filepath.fromUri('file:///home/user/my%20project/main.dbml');
        expect(filepath.fsPath).toBe('/home/user/my project/main.dbml');
      });

      it('handles encoded unicode in URI', () => {
        const filepath = Filepath.fromUri('file:///home/user/%E6%97%A5%E6%9C%AC%E8%AA%9E/main.dbml');
        expect(filepath.fsPath).toBe('/home/user/日本語/main.dbml');
      });
    });

    describe('inmemory:// protocol', () => {
      it('parses inmemory:// URI', () => {
        const filepath = Filepath.fromUri('inmemory://model/1');
        expect(filepath.absolute).toBe('/model/1');
      });
    });

    describe('vscode-userdata:// protocol', () => {
      it('parses vscode-userdata URI', () => {
        const filepath = Filepath.fromUri('vscode-userdata:///home/user/main.dbml');
        expect(filepath.absolute).toBe('/home/user/main.dbml');
      });
    });

    describe('plain paths (no protocol)', () => {
      it('falls back to plain absolute path', () => {
        const filepath = Filepath.fromUri('/home/user/main.dbml');
        expect(filepath.absolute).toBe('/home/user/main.dbml');
      });

      it('falls back to Windows path', () => {
        const filepath = Filepath.fromUri('C:/Users/project/main.dbml');
        expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
      });
    });
  });

  describe('toUri', () => {
    it('returns raw path when no protocol', () => {
      const filepath = Filepath.from('/home/user/main.dbml');
      expect(filepath.toUri()).toBe('/home/user/main.dbml');
    });

    it('returns file:// URI with protocol option', () => {
      const filepath = Filepath.from('/home/user/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      expect(uri).toBe('file:///home/user/main.dbml');
    });

    it('preserves protocol from fromUri', () => {
      const filepath = Filepath.fromUri('file:///home/user/main.dbml');
      const uri = filepath.toUri();
      expect(uri).toBe('file:///home/user/main.dbml');
    });

    it('handles Windows drive letter with file:// protocol', () => {
      const filepath = Filepath.from('C:/Users/project/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      expect(uri).toMatch(/^file:\/\/\/[Cc]:\/Users\/project\/main\.dbml$/);
    });

    it('round-trips fromUri -> toUri for unix path', () => {
      const original = 'file:///home/user/main.dbml';
      const filepath = Filepath.fromUri(original);
      expect(filepath.toUri()).toBe(original);
    });

    it('round-trips fromUri -> toUri for Windows path', () => {
      const original = 'file:///C:/Users/project/main.dbml';
      const filepath = Filepath.fromUri(original);
      const uri = filepath.toUri();
      // URL may normalize casing, just check structure
      expect(uri).toMatch(/^file:\/\/\/[Cc]:\/Users\/project\/main\.dbml$/);
    });

    it('round-trips fromUri -> toUri with encoded spaces', () => {
      const original = 'file:///home/user/my%20project/main.dbml';
      const filepath = Filepath.fromUri(original);
      expect(filepath.toUri()).toBe(original);
    });
  });

  describe('fsPath', () => {
    it('returns same as absolute (no encoding in storage)', () => {
      const filepath = Filepath.from('/home/user/my project/main.dbml');
      expect(filepath.fsPath).toBe(filepath.absolute);
      expect(filepath.fsPath).toBe('/home/user/my project/main.dbml');
    });

    it('fromUri decodes then fsPath returns decoded', () => {
      const filepath = Filepath.fromUri('file:///home/user/my%20project/main.dbml');
      expect(filepath.fsPath).toBe('/home/user/my project/main.dbml');
    });
  });

  describe('dirname, basename, extname', () => {
    it('returns dirname for unix path', () => {
      const filepath = Filepath.from('/home/user/project/main.dbml');
      expect(filepath.dirname).toBe('/home/user/project');
    });

    it('returns dirname for Windows path', () => {
      const filepath = Filepath.from('C:/Users/project/main.dbml');
      expect(filepath.dirname).toBe('C:/Users/project');
    });

    it('returns basename', () => {
      const filepath = Filepath.from('/home/user/main.dbml');
      expect(filepath.basename).toBe('main.dbml');
    });

    it('returns extname', () => {
      const filepath = Filepath.from('/home/user/main.dbml');
      expect(filepath.extname).toBe('.dbml');
    });

    it('returns empty extname when no extension', () => {
      const filepath = Filepath.from('/home/user/Makefile');
      expect(filepath.extname).toBe('');
    });
  });

  describe('resolve', () => {
    it('resolves relative path from unix file', () => {
      const filepath = Filepath.from('/home/user/project/main.dbml');
      const resolved = filepath.resolve('./other.dbml');
      expect(resolved.absolute).toBe('/home/user/project/other.dbml');
    });

    it('resolves .. from unix file', () => {
      const filepath = Filepath.from('/home/user/project/main.dbml');
      const resolved = filepath.resolve('../shared/types.dbml');
      expect(resolved.absolute).toBe('/home/user/shared/types.dbml');
    });

    it('resolves relative path from Windows file', () => {
      const filepath = Filepath.from('C:/Users/project/main.dbml');
      const resolved = filepath.resolve('./other.dbml');
      expect(resolved.absolute).toBe('C:/Users/project/other.dbml');
    });

    it('resolves .. from Windows file', () => {
      const filepath = Filepath.from('C:/Users/project/main.dbml');
      const resolved = filepath.resolve('../shared/types.dbml');
      expect(resolved.absolute).toBe('C:/Users/shared/types.dbml');
    });
  });

  describe('Filepath.resolve (static)', () => {
    it('resolves from unix dir', () => {
      const filepath = Filepath.resolve('/home/user/project', './main.dbml');
      expect(filepath.absolute).toBe('/home/user/project/main.dbml');
    });

    it('resolves from Windows dir', () => {
      const filepath = Filepath.resolve('C:/Users/project', './main.dbml');
      expect(filepath.absolute).toBe('C:/Users/project/main.dbml');
    });
  });

  describe('join', () => {
    it('joins segments on unix path', () => {
      const filepath = Filepath.from('/home/user');
      const joined = filepath.join('project', 'main.dbml');
      expect(joined.absolute).toBe('/home/user/project/main.dbml');
    });

    it('joins segments on Windows path', () => {
      const filepath = Filepath.from('C:/Users');
      const joined = filepath.join('project', 'main.dbml');
      expect(joined.absolute).toBe('C:/Users/project/main.dbml');
    });
  });

  describe('relativeTo', () => {
    it('returns ./ prefixed relative path for sibling', () => {
      const filepath = Filepath.from('/home/user/project/other.dbml');
      expect(filepath.relativeTo('/home/user/project')).toBe('./other.dbml');
    });

    it('returns ../ for parent directory', () => {
      const filepath = Filepath.from('/home/user/shared/types.dbml');
      expect(filepath.relativeTo('/home/user/project')).toBe('../shared/types.dbml');
    });

    it('works with Windows paths', () => {
      const filepath = Filepath.from('C:/Users/project/other.dbml');
      expect(filepath.relativeTo('C:/Users/project')).toBe('./other.dbml');
    });

    it('returns ../ for Windows parent', () => {
      const filepath = Filepath.from('C:/Users/shared/types.dbml');
      expect(filepath.relativeTo('C:/Users/project')).toBe('../shared/types.dbml');
    });
  });

  describe('equals', () => {
    it('same unix paths are equal', () => {
      const first = Filepath.from('/home/user/main.dbml');
      const second = Filepath.from('/home/user/main.dbml');
      expect(first.equals(second)).toBe(true);
    });

    it('different unix paths are not equal', () => {
      const first = Filepath.from('/home/user/a.dbml');
      const second = Filepath.from('/home/user/b.dbml');
      expect(first.equals(second)).toBe(false);
    });

    it('same Windows paths are equal', () => {
      const first = Filepath.from('C:/Users/main.dbml');
      const second = Filepath.from('C:/Users/main.dbml');
      expect(first.equals(second)).toBe(true);
    });

    it('normalized paths are equal', () => {
      const first = Filepath.from('/home/user/../user/main.dbml');
      const second = Filepath.from('/home/user/main.dbml');
      expect(first.equals(second)).toBe(true);
    });
  });

  describe('isParentOf', () => {
    it('parent directory is parent of child file', () => {
      const parent = Filepath.from('/home/user');
      const child = Filepath.from('/home/user/main.dbml');
      expect(parent.isParentOf(child)).toBe(true);
    });

    it('same path is not parent of itself', () => {
      const filepath = Filepath.from('/home/user');
      expect(filepath.isParentOf(filepath)).toBe(false);
    });

    it('child is not parent of parent', () => {
      const parent = Filepath.from('/home/user');
      const child = Filepath.from('/home/user/main.dbml');
      expect(child.isParentOf(parent)).toBe(false);
    });

    it('works with Windows paths', () => {
      const parent = Filepath.from('C:/Users/project');
      const child = Filepath.from('C:/Users/project/main.dbml');
      expect(parent.isParentOf(child)).toBe(true);
    });
  });

  describe('isRelative (static)', () => {
    it('relative path returns true', () => {
      expect(Filepath.isRelative('./foo.dbml')).toBe(true);
      expect(Filepath.isRelative('../foo.dbml')).toBe(true);
      expect(Filepath.isRelative('foo.dbml')).toBe(true);
    });

    it('absolute unix path returns false', () => {
      expect(Filepath.isRelative('/home/user/foo.dbml')).toBe(false);
    });

    it('absolute Windows path returns false', () => {
      expect(Filepath.isRelative('C:/Users/foo.dbml')).toBe(false);
      expect(Filepath.isRelative('C:\\Users\\foo.dbml')).toBe(false);
    });
  });

  describe('intern', () => {
    it('same paths produce same intern key', () => {
      const first = Filepath.from('/home/user/main.dbml');
      const second = Filepath.from('/home/user/main.dbml');
      expect(first.intern()).toBe(second.intern());
    });

    it('different paths produce different intern keys', () => {
      const first = Filepath.from('/home/user/a.dbml');
      const second = Filepath.from('/home/user/b.dbml');
      expect(first.intern()).not.toBe(second.intern());
    });
  });

  describe('URI round-trip edge cases', () => {
    it('round-trips path with spaces', () => {
      const filepath = Filepath.from('/home/user/my project/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      const filepath2 = Filepath.fromUri(uri);
      expect(filepath.equals(filepath2)).toBe(true);
      expect(filepath2.fsPath).toBe('/home/user/my project/main.dbml');
    });

    it('round-trips Windows path with spaces', () => {
      const filepath = Filepath.from('C:/Users/My Documents/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      const filepath2 = Filepath.fromUri(uri);
      expect(filepath.equals(filepath2)).toBe(true);
      expect(filepath2.fsPath).toBe('C:/Users/My Documents/main.dbml');
    });

    it('round-trips path with unicode', () => {
      const filepath = Filepath.from('/home/user/日本語/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      const filepath2 = Filepath.fromUri(uri);
      expect(filepath.equals(filepath2)).toBe(true);
      expect(filepath2.fsPath).toBe('/home/user/日本語/main.dbml');
    });

    it('round-trips path with parentheses', () => {
      const filepath = Filepath.from('/home/user/project (copy)/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      const filepath2 = Filepath.fromUri(uri);
      expect(filepath.equals(filepath2)).toBe(true);
    });

    it('round-trips path with hash (#) in name', () => {
      const filepath = Filepath.from('/home/user/C# project/main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      const filepath2 = Filepath.fromUri(uri);
      expect(filepath.equals(filepath2)).toBe(true);
    });

    it('round-trips Windows backslash path through URI', () => {
      const filepath = Filepath.from('C:\\Users\\project\\main.dbml');
      const uri = filepath.toUri({ protocol: 'file' });
      const filepath2 = Filepath.fromUri(uri);
      expect(filepath.equals(filepath2)).toBe(true);
    });
  });
});
