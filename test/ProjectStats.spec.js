const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const ModuleStats = require('../src/ModuleStats');
const Project = require('../src/Project');
const ProjectStats = require('../src/ProjectStats');

describe('ProjectStats', () => {
  describe('#fetchMetricForProjects', () => {
    it('should error on unsupported metric', () => {
      return expect(
        new ProjectStats('somepackage').fetchMetricForProjects('unknown'),
        'to be rejected with',
        'unknown is not a supported metric.'
      );
    });
  });

  describe('#fetchMetricForProjects (downloads)', () => {
    let createPackageRequestStub;

    beforeEach(() => {
      createPackageRequestStub = sinon.stub(
        ModuleStats,
        'createPackageRequest'
      );
    });

    afterEach(() => {
      createPackageRequestStub.restore();
    });

    it('should total and return the stats for each package', () => {
      createPackageRequestStub
        .onFirstCall()
        .resolves([{ value: 2 }, { value: 3 }])
        .onSecondCall()
        .resolves([]);

      const projectStats = new ProjectStats([
        new Project('somedependent'),
        new Project('otherdependent')
      ]);

      return expect(
        projectStats.fetchMetricForProjects('downloads'),
        'to be fulfilled with',
        {
          somedependent: 5,
          otherdependent: 0
        }
      );
    });
  });

  describe('#fetchMetricForProjects (stars)', () => {
    let createGitHubRepositoryRequestStub;

    beforeEach(() => {
      createGitHubRepositoryRequestStub = sinon.stub(
        ModuleStats,
        'createGitHubRepositoryRequest'
      );
    });

    afterEach(() => {
      createGitHubRepositoryRequestStub.restore();
    });

    it('should total and return the stats for each package', () => {
      createGitHubRepositoryRequestStub
        .onFirstCall()
        .resolves({ stargazers_count: 5 })
        .onSecondCall()
        .resolves({ stargazers_count: 0 });

      const projectStats = new ProjectStats([
        new Project('https://github.com/org/foo.git'),
        new Project('https://github.com/org/bar')
      ]);

      return expect(
        projectStats.fetchMetricForProjects('stars'),
        'to be fulfilled with',
        {
          'https://github.com/org/foo.git': 5,
          'https://github.com/org/bar': 0
        }
      );
    });
  });
});
