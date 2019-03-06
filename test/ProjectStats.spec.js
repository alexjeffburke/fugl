const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const ModuleStats = require('../src/ModuleStats');
const Project = require('../src/Project');
const ProjectStats = require('../src/ProjectStats');

describe('ProjectStats', () => {
  describe('#fetchMetricForProjects', () => {
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

    it('should error on unsupported metric', () => {
      return expect(
        new ProjectStats('somepackage').fetchMetricForProjects('unknown'),
        'to be rejected with',
        'unknown is not a supported metric.'
      );
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
});
