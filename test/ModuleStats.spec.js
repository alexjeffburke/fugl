const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const ModuleStats = require('../src/ModuleStats');

describe('ModuleStats', () => {
  it('should throw on missing module name', () => {
    return expect(
      () => {
        new ModuleStats();
      },
      'to throw',
      'Invalid module name.'
    );
  });

  it('should throw on empty module name', () => {
    return expect(
      () => {
        new ModuleStats(' ');
      },
      'to throw',
      'Invalid module name.'
    );
  });

  it('should error on unsupported metric', () => {
    return expect(
      new ModuleStats('somepackage').fetchDepedentsWithMetric('unknown'),
      'to be rejected with',
      'unknown is not a supported metric.'
    );
  });

  describe('#fetchDependents', () => {
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

    it('should fetch and record dependents', () => {
      createPackageRequestStub.resolves(['foo', 'bar', 'baz']);
      const moduleStats = new ModuleStats('sompackage');

      return expect(moduleStats.fetchDependents(), 'to be fulfilled with', [
        'foo',
        'bar',
        'baz'
      ]).then(() => {
        expect(moduleStats.dependents, 'to equal', ['foo', 'bar', 'baz']);
      });
    });

    it('should return previously fetched dependents', () => {
      createPackageRequestStub.resolves(['foo', 'bar', 'baz']);
      const moduleStats = new ModuleStats('sompackage');
      moduleStats.dependents = ['quux'];

      return expect(moduleStats.fetchDependents(), 'to be fulfilled with', [
        'quux'
      ]).then(() => {
        expect(createPackageRequestStub, 'was not called');
      });
    });
  });

  describe('#fetchDepedentsWithDownloads', () => {
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

      const moduleStats = new ModuleStats('sompackage');
      moduleStats.dependents = ['somedependent', 'otherdependent'];

      return expect(
        moduleStats.fetchDepedentsWithDownloads(),
        'to be fulfilled with',
        {
          somedependent: 5,
          otherdependent: 0
        }
      );
    });
  });

  describe('ModuleStats.createPackageRequest', () => {
    function createFakeRegistry() {
      const moduleNamespace = {
        dependents: sinon.stub().named('dependents'),
        downloads: sinon.stub().named('downloads')
      };

      return [
        {
          module: sinon
            .stub()
            .named('module')
            .returns(moduleNamespace)
        },
        moduleNamespace
      ];
    }

    it('should reject on request error', () => {
      const [registry, moduleNamespace] = createFakeRegistry();

      moduleNamespace.dependents.callsArgWith(0, new Error('failure'));

      return expect(
        () =>
          ModuleStats.createPackageRequest('somepackage', 'dependents', {
            _registry: registry
          }),
        'to be rejected with',
        'failure'
      );
    });
  });
});
