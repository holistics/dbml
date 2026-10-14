import { describe, expect, it } from 'vitest';
import { Filepath } from '@/core/types/filepath';

describe('Filepath', () => {
  describe('construction and normalization', () => {
    describe('Linux/Mac paths', () => {
      it('accepts absolute unix path', () => {
        const fp = Filepath.from('/home/user/project/main.dbml');
        expect(fp.urlSafePath).toBe('/home/user/project/main.dbml');
      });

      it('accepts root path', () => {
        const fp = Filepath.from('/');
        expect(fp.urlSafePath).toBe('/');
      });

      it('normalizes redundant slashes', () => {
        const fp = Filepath.from('/home//user///project/main.dbml');
        expect(fp.urlSafePath).toBe('/home/user/project/main.dbml');
      });

      it('normalizes . and .. segments', () => {
        const fp = Filepath.from('/home/user/./project/../project/main.dbml');
        expect(fp.urlSafePath).toBe('/home/user/project/main.dbml');
      });

      it('rejects relative path', () => {
        expect(() => Filepath.from('relative/path.dbml')).toThrow();
        expect(() => Filepath.from('./relative/path.dbml')).toThrow();
        expect(() => Filepath.from('../relative/path.dbml')).toThrow();
      });
    });

    describe('Windows paths', () => {
      it('accepts C:/ drive path', () => {
        const fp = Filepath.from('C:/Users/project/main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });

      it('accepts lowercase drive letter (pathe normalizes to uppercase)', () => {
        const fp = Filepath.from('c:/Users/project/main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });

      it('accepts C:\\ backslash path', () => {
        const fp = Filepath.from('C:\\Users\\project\\main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });

      it('accepts mixed slash/backslash', () => {
        const fp = Filepath.from('C:\\Users/project\\main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });

      it('normalizes . and .. in Windows paths', () => {
        const fp = Filepath.from('C:/Users/./project/../project/main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });
    });

    describe('paths with special characters', () => {
      it('handles spaces in path', () => {
        const fp = Filepath.from('/home/user/my project/main.dbml');
        expect(fp.fsPath).toBe('/home/user/my project/main.dbml');
      });

      it('handles already-encoded segments', () => {
        const fp = Filepath.from('/home/user/my%20project/main.dbml');
        expect(fp.fsPath).toBe('/home/user/my project/main.dbml');
      });

      it('handles unicode characters', () => {
        const fp = Filepath.from('/home/user/日本語/main.dbml');
        expect(fp.fsPath).toBe('/home/user/日本語/main.dbml');
      });

      it('round-trips encoded and unencoded spaces consistently', () => {
        const fp1 = Filepath.from('/home/user/my project/main.dbml');
        const fp2 = Filepath.from('/home/user/my%20project/main.dbml');
        expect(fp1.equals(fp2)).toBe(true);
      });
    });
  });

  describe('fromUri', () => {
    describe('file:// protocol', () => {
      it('parses file:///unix/path', () => {
        const fp = Filepath.fromUri('file:///home/user/main.dbml');
        expect(fp.urlSafePath).toBe('/home/user/main.dbml');
      });

      it('parses file:///C:/windows/path', () => {
        const fp = Filepath.fromUri('file:///C:/Users/project/main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });

      it('handles encoded spaces in URI', () => {
        const fp = Filepath.fromUri('file:///home/user/my%20project/main.dbml');
        expect(fp.fsPath).toBe('/home/user/my project/main.dbml');
      });

      it('handles encoded unicode in URI', () => {
        const fp = Filepath.fromUri('file:///home/user/%E6%97%A5%E6%9C%AC%E8%AA%9E/main.dbml');
        expect(fp.fsPath).toBe('/home/user/日本語/main.dbml');
      });
    });

    describe('inmemory:// protocol', () => {
      it('parses inmemory:// URI', () => {
        const fp = Filepath.fromUri('inmemory://model/1');
        expect(fp.urlSafePath).toBe('/model/1');
      });
    });

    describe('vscode-userdata:// protocol', () => {
      it('parses vscode-userdata URI', () => {
        const fp = Filepath.fromUri('vscode-userdata:///home/user/main.dbml');
        expect(fp.urlSafePath).toBe('/home/user/main.dbml');
      });
    });

    describe('plain paths (no protocol)', () => {
      it('falls back to plain absolute path', () => {
        const fp = Filepath.fromUri('/home/user/main.dbml');
        expect(fp.urlSafePath).toBe('/home/user/main.dbml');
      });

      it('falls back to Windows path', () => {
        const fp = Filepath.fromUri('C:/Users/project/main.dbml');
        expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
      });
    });
  });

  describe('toUri', () => {
    it('returns raw path when no protocol', () => {
      const fp = Filepath.from('/home/user/main.dbml');
      expect(fp.toUri()).toBe('/home/user/main.dbml');
    });

    it('returns file:// URI with protocol option', () => {
      const fp = Filepath.from('/home/user/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      expect(uri).toBe('file:///home/user/main.dbml');
    });

    it('preserves protocol from fromUri', () => {
      const fp = Filepath.fromUri('file:///home/user/main.dbml');
      const uri = fp.toUri();
      expect(uri).toBe('file:///home/user/main.dbml');
    });

    it('handles Windows drive letter with file:// protocol', () => {
      const fp = Filepath.from('C:/Users/project/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      expect(uri).toMatch(/^file:\/\/\/[Cc]:\/Users\/project\/main\.dbml$/);
    });

    it('round-trips fromUri -> toUri for unix path', () => {
      const original = 'file:///home/user/main.dbml';
      const fp = Filepath.fromUri(original);
      expect(fp.toUri()).toBe(original);
    });

    it('round-trips fromUri -> toUri for Windows path', () => {
      const original = 'file:///C:/Users/project/main.dbml';
      const fp = Filepath.fromUri(original);
      const uri = fp.toUri();
      // URL may normalize casing, just check structure
      expect(uri).toMatch(/^file:\/\/\/[Cc]:\/Users\/project\/main\.dbml$/);
    });

    it('round-trips fromUri -> toUri with encoded spaces', () => {
      const original = 'file:///home/user/my%20project/main.dbml';
      const fp = Filepath.fromUri(original);
      expect(fp.toUri()).toBe(original);
    });
  });

  describe('fsPath', () => {
    it('decodes URI-encoded segments', () => {
      const fp = Filepath.from('/home/user/my%20project/main.dbml');
      expect(fp.fsPath).toBe('/home/user/my project/main.dbml');
    });

    it('returns unchanged path when no encoding', () => {
      const fp = Filepath.from('/home/user/project/main.dbml');
      expect(fp.fsPath).toBe('/home/user/project/main.dbml');
    });

    it('decodes Windows path correctly', () => {
      const fp = Filepath.from('C:/Users/My%20Documents/main.dbml');
      expect(fp.fsPath).toBe('C:/Users/My Documents/main.dbml');
    });
  });

  describe('dirname, basename, extname', () => {
    it('returns dirname for unix path', () => {
      const fp = Filepath.from('/home/user/project/main.dbml');
      expect(fp.dirname).toBe('/home/user/project');
    });

    it('returns dirname for Windows path', () => {
      const fp = Filepath.from('C:/Users/project/main.dbml');
      expect(fp.dirname).toBe('C:/Users/project');
    });

    it('returns basename', () => {
      const fp = Filepath.from('/home/user/main.dbml');
      expect(fp.basename).toBe('main.dbml');
    });

    it('returns extname', () => {
      const fp = Filepath.from('/home/user/main.dbml');
      expect(fp.extname).toBe('.dbml');
    });

    it('returns empty extname when no extension', () => {
      const fp = Filepath.from('/home/user/Makefile');
      expect(fp.extname).toBe('');
    });
  });

  describe('resolve', () => {
    it('resolves relative path from unix file', () => {
      const fp = Filepath.from('/home/user/project/main.dbml');
      const resolved = fp.resolve('./other.dbml');
      expect(resolved.urlSafePath).toBe('/home/user/project/other.dbml');
    });

    it('resolves .. from unix file', () => {
      const fp = Filepath.from('/home/user/project/main.dbml');
      const resolved = fp.resolve('../shared/types.dbml');
      expect(resolved.urlSafePath).toBe('/home/user/shared/types.dbml');
    });

    it('resolves relative path from Windows file', () => {
      const fp = Filepath.from('C:/Users/project/main.dbml');
      const resolved = fp.resolve('./other.dbml');
      expect(resolved.urlSafePath).toBe('C:/Users/project/other.dbml');
    });

    it('resolves .. from Windows file', () => {
      const fp = Filepath.from('C:/Users/project/main.dbml');
      const resolved = fp.resolve('../shared/types.dbml');
      expect(resolved.urlSafePath).toBe('C:/Users/shared/types.dbml');
    });
  });

  describe('Filepath.resolve (static)', () => {
    it('resolves from unix dir', () => {
      const fp = Filepath.resolve('/home/user/project', './main.dbml');
      expect(fp.urlSafePath).toBe('/home/user/project/main.dbml');
    });

    it('resolves from Windows dir', () => {
      const fp = Filepath.resolve('C:/Users/project', './main.dbml');
      expect(fp.urlSafePath).toBe('C:/Users/project/main.dbml');
    });
  });

  describe('join', () => {
    it('joins segments on unix path', () => {
      const fp = Filepath.from('/home/user');
      const joined = fp.join('project', 'main.dbml');
      expect(joined.urlSafePath).toBe('/home/user/project/main.dbml');
    });

    it('joins segments on Windows path', () => {
      const fp = Filepath.from('C:/Users');
      const joined = fp.join('project', 'main.dbml');
      expect(joined.urlSafePath).toBe('C:/Users/project/main.dbml');
    });
  });

  describe('relativeTo', () => {
    it('returns ./ prefixed relative path for sibling', () => {
      const fp = Filepath.from('/home/user/project/other.dbml');
      expect(fp.relativeTo('/home/user/project')).toBe('./other.dbml');
    });

    it('returns ../ for parent directory', () => {
      const fp = Filepath.from('/home/user/shared/types.dbml');
      expect(fp.relativeTo('/home/user/project')).toBe('../shared/types.dbml');
    });

    it('works with Windows paths', () => {
      const fp = Filepath.from('C:/Users/project/other.dbml');
      expect(fp.relativeTo('C:/Users/project')).toBe('./other.dbml');
    });

    it('returns ../ for Windows parent', () => {
      const fp = Filepath.from('C:/Users/shared/types.dbml');
      expect(fp.relativeTo('C:/Users/project')).toBe('../shared/types.dbml');
    });
  });

  describe('equals', () => {
    it('same unix paths are equal', () => {
      const a = Filepath.from('/home/user/main.dbml');
      const b = Filepath.from('/home/user/main.dbml');
      expect(a.equals(b)).toBe(true);
    });

    it('different unix paths are not equal', () => {
      const a = Filepath.from('/home/user/a.dbml');
      const b = Filepath.from('/home/user/b.dbml');
      expect(a.equals(b)).toBe(false);
    });

    it('same Windows paths are equal', () => {
      const a = Filepath.from('C:/Users/main.dbml');
      const b = Filepath.from('C:/Users/main.dbml');
      expect(a.equals(b)).toBe(true);
    });

    it('normalized paths are equal', () => {
      const a = Filepath.from('/home/user/../user/main.dbml');
      const b = Filepath.from('/home/user/main.dbml');
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('isParentOf', () => {
    it('parent directory is parent of child file', () => {
      const parent = Filepath.from('/home/user');
      const child = Filepath.from('/home/user/main.dbml');
      expect(parent.isParentOf(child)).toBe(true);
    });

    it('same path is not parent of itself', () => {
      const fp = Filepath.from('/home/user');
      expect(fp.isParentOf(fp)).toBe(false);
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
      const a = Filepath.from('/home/user/main.dbml');
      const b = Filepath.from('/home/user/main.dbml');
      expect(a.intern()).toBe(b.intern());
    });

    it('different paths produce different intern keys', () => {
      const a = Filepath.from('/home/user/a.dbml');
      const b = Filepath.from('/home/user/b.dbml');
      expect(a.intern()).not.toBe(b.intern());
    });
  });

  describe('URI round-trip edge cases', () => {
    it('round-trips path with spaces', () => {
      const fp = Filepath.from('/home/user/my project/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      const fp2 = Filepath.fromUri(uri);
      expect(fp.equals(fp2)).toBe(true);
      expect(fp2.fsPath).toBe('/home/user/my project/main.dbml');
    });

    it('round-trips Windows path with spaces', () => {
      const fp = Filepath.from('C:/Users/My Documents/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      const fp2 = Filepath.fromUri(uri);
      expect(fp.equals(fp2)).toBe(true);
      expect(fp2.fsPath).toBe('C:/Users/My Documents/main.dbml');
    });

    it('round-trips path with unicode', () => {
      const fp = Filepath.from('/home/user/日本語/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      const fp2 = Filepath.fromUri(uri);
      expect(fp.equals(fp2)).toBe(true);
      expect(fp2.fsPath).toBe('/home/user/日本語/main.dbml');
    });

    it('round-trips path with parentheses', () => {
      const fp = Filepath.from('/home/user/project (copy)/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      const fp2 = Filepath.fromUri(uri);
      expect(fp.equals(fp2)).toBe(true);
    });

    it('round-trips path with hash (#) in name', () => {
      const fp = Filepath.from('/home/user/C# project/main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      const fp2 = Filepath.fromUri(uri);
      expect(fp.equals(fp2)).toBe(true);
    });

    it('round-trips Windows backslash path through URI', () => {
      const fp = Filepath.from('C:\\Users\\project\\main.dbml');
      const uri = fp.toUri({ protocol: 'file' });
      const fp2 = Filepath.fromUri(uri);
      expect(fp.equals(fp2)).toBe(true);
    });
  });
});
