const expect = require('unexpected');

const Project = require('../src/Project');

describe('Project', () => {
  it('should error with project missing name', () => {
    return expect(
      () => {
        new Project();
      },
      'to throw',
      'project supplied without name'
    );
  });

  it('should error with project missing name (number)', () => {
    return expect(
      () => {
        new Project(1);
      },
      'to throw',
      'project supplied without name'
    );
  });

  it('should error with project missing name (object)', () => {
    return expect(
      () => {
        new Project({});
      },
      'to throw',
      'project supplied without name'
    );
  });

  it('should error with project missing name (array)', () => {
    return expect(
      () => {
        new Project([]);
      },
      'to throw',
      'project supplied without name'
    );
  });

  it('should error with project name that is not a repository', () => {
    return expect(
      () => {
        new Project('FOO');
      },
      'to throw',
      'project FOO is not a repository'
    );
  });

  describe('isRepoUrl', () => {
    const isRepoUrl = Project.isRepoUrl;

    it('should not allow "foo"', () => {
      expect(isRepoUrl('foo'), 'to be false');
    });

    it('should not allow "foo/bar"', () => {
      expect(isRepoUrl('foo/bar'), 'to be false');
    });

    it('should not allow "foo/bar.git"', () => {
      expect(isRepoUrl('foo/bar.git'), 'to be false');
    });

    it('should allow "https://foo/bar.git"', () => {
      expect(isRepoUrl('https://foo/bar.git'), 'to be true');
    });

    it('should allow "https://foo/bar"', () => {
      expect(isRepoUrl('https://foo/bar'), 'to be true');
    });
  });
});
