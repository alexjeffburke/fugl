const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

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
        new Project('@FOO');
      },
      'to throw',
      'project @FOO is not a repository'
    );
  });

  it('should allow git', () => {
    const project = new Project('https://service.tld/foo');

    return expect(project, 'to exhaustively satisfy', {
      name: 'https://service.tld/foo',
      kind: 'git',
      repoUrl: 'https://service.tld/foo'
    });
  });

  it('should allow npm', () => {
    const project = new Project('somepackage');

    return expect(project, 'to exhaustively satisfy', {
      name: 'somepackage',
      kind: 'npm',
      repoUrl: null
    });
  });

  describe('#queryNpmForPackageAndUpdate', () => {
    it('should error on npm query failure', () => {
      const project = new Project('somepackage');
      const moduleStats = {
        fetchInfo: sinon.stub().rejects(new Error())
      };

      return expect(
        () => project.queryNpmForPackageAndUpdate('somepackage', moduleStats),
        'to be rejected with',
        'unable to access package somepackage'
      );
    });

    it('should error missing repository', () => {
      const project = new Project('somepackage');
      const moduleStats = {
        fetchInfo: sinon.stub().resolves({ name: 'somepackage' })
      };

      return expect(
        () => project.queryNpmForPackageAndUpdate('somepackage', moduleStats),
        'to be rejected with',
        'project somepackage repository is missing'
      );
    });

    it('should error on bad repository', () => {
      const project = new Project('somepackage');
      const moduleStats = {
        fetchInfo: sinon
          .stub()
          .resolves({ name: 'somepackage', repository: { url: 'baz' } })
      };

      return expect(
        () => project.queryNpmForPackageAndUpdate('somepackage', moduleStats),
        'to be rejected with',
        'project somepackage repository is invalid'
      );
    });

    it('should update repoUrl', () => {
      const project = new Project('somepackage');
      const moduleStats = {
        fetchInfo: sinon
          .stub()
          .resolves({ repository: { url: 'https://service.tld/foo' } })
      };

      return expect(
        () => project.queryNpmForPackageAndUpdate('somepackage', moduleStats),
        'to be fulfilled'
      ).then(() => {
        expect(project.repoUrl, 'to equal', 'https://service.tld/foo');
      });
    });
  });

  describe('#toDependent', () => {
    it('should not return kind or repoUrl', () => {
      const project = new Project('https://service.tld/foo');

      return expect(project.toDependent(), 'not to have keys', [
        'kind',
        'repoUrl'
      ]);
    });

    it('should return repoUrl as the name', () => {
      const project = new Project('somepackage');
      project.repoUrl = 'https://service.tld/foo';

      return expect(project.toDependent(), 'to equal', {
        name: 'https://service.tld/foo'
      });
    });
  });

  describe('#verify', () => {
    it('should verify git', () => {
      const project = new Project('https://service.tld/foo');
      sinon.stub(project, 'queryNpmForPackageAndUpdate');

      return expect(() => project.verify(), 'to be fulfilled').then(() => {
        expect(project.queryNpmForPackageAndUpdate, 'was not called');
      });
    });

    it('should verify npm', () => {
      const project = new Project('package');
      sinon
        .stub(project, 'queryNpmForPackageAndUpdate')
        .resolves({ repository: 'https://service.tld/foo' });

      return expect(() => project.verify(), 'to be fulfilled').then(() => {
        expect(
          project.queryNpmForPackageAndUpdate,
          'to have a call satisfying',
          ['package']
        );
      });
    });
  });

  describe('Project.isRepoUrl', () => {
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
