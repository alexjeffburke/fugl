const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const Project = require('../src/Project');
const ShoulderProject = require('shoulder/lib/Project');

describe('Project', () => {
  it('should instantiate a ShoulderProject', () => {
    const project = new Project('somepackage');

    return expect(project.shoulderProject, 'to be a', ShoulderProject);
  });

  it('should allow instantiation with an object', () => {
    const project = new Project({ name: 'somepackage' });

    return expect(project.shoulderProject, 'to be a', ShoulderProject);
  });

  it('should default the config null', () => {
    const project = new Project({ name: 'somepackage' });

    return expect(project, 'to satisfy', {
      config: null
    });
  });

  describe('with additional options', () => {
    it('should allow specifying a install', () => {
      const project = new Project({ name: 'somepackage', install: 'xxx' });

      return expect(project.config, 'to satisfy', {
        install: 'xxx'
      });
    });

    it('should allow specifying a afterinstall', () => {
      const project = new Project({ name: 'somepackage', afterinstall: 'xxx' });

      return expect(project.config, 'to satisfy', {
        afterinstall: 'xxx'
      });
    });

    it('should allow specifying a test', () => {
      const project = new Project({ name: 'somepackage', test: 'xxx' });

      return expect(project.config, 'to satisfy', {
        test: 'xxx'
      });
    });
  });

  describe('#.name', () => {
    it('should allow git', () => {
      const project = new Project('https://service.tld/foo');

      return expect(project.name, 'to equal', 'https://service.tld/foo');
    });

    it('should allow npm', () => {
      const project = new Project('somepackage');

      return expect(project.name, 'to equal', 'somepackage');
    });
  });

  describe('#.repoUrl', () => {
    it('should return ShoulderProject repoUrl', () => {
      const project = new Project('somepackage');
      project.shoulderProject.repoUrl = 'https://service.tld/foo';

      return expect(project.repoUrl, 'to equal', 'https://service.tld/foo');
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

    it('should return any config options', () => {
      const project = new Project('https://service.tld/foo');
      project.config = { foo: true, baz: 1 };

      return expect(project.toDependent(), 'to equal', {
        name: 'https://service.tld/foo',
        foo: true,
        baz: 1
      });
    });

    it('should return repoUrl as the name', () => {
      const project = new Project('somepackage');
      project.shoulderProject.repoUrl = 'https://service.tld/foo';

      return expect(project.toDependent(), 'to equal', {
        name: 'https://service.tld/foo'
      });
    });
  });

  describe('#verify', () => {
    it('should forward the verification call git', () => {
      const project = new Project('somepackage');
      sinon.stub(project.shoulderProject, 'verify');

      project.verify('foobar');

      expect(project.shoulderProject.verify, 'to have a call satisfying', [
        'foobar'
      ]);
    });
  });
});
