const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const cli = require('../src/cli');

function createMockModuleStats() {
  const MockModuleStats = sinon.stub().named('MockModuleStats');

  MockModuleStats._instance = {
    fetchDepedentsWithMetric: sinon.stub().named('fetchDependentsWithMetric')
  };
  MockModuleStats.packageNamesByMagnitude = sinon
    .stub()
    .named('packageNamesByMagnitude');

  return MockModuleStats.callsFake(() => MockModuleStats._instance);
}

describe('cli', () => {
  describe('fetch', () => {
    it('should construct ModuleStats', () => {
      const MockModuleStats = createMockModuleStats();
      MockModuleStats._instance.fetchDepedentsWithMetric.rejects(
        new Error('fail')
      );
      const args = {
        package: 'somepackage',
        librariesio: 'SOME_KEY'
      };

      return expect(
        () =>
          cli.fetch(null, args, {
            _ModuleStats: MockModuleStats
          }),
        'to be rejected'
      ).then(() => {
        expect(MockModuleStats, 'to have a call satisfying', [
          'somepackage',
          { librariesIoApiKey: 'SOME_KEY' }
        ]);
      });
    });

    it('should execute the dependents fetch', () => {
      const MockModuleStats = createMockModuleStats();
      MockModuleStats._instance.fetchDepedentsWithMetric.resolves({
        foo: 'bar'
      });
      MockModuleStats.packageNamesByMagnitude.resolves(['somedependent']);
      const log = sinon.stub().named('console.log');
      const args = {};

      return expect(
        () =>
          cli.fetch(null, args, {
            _ModuleStats: MockModuleStats,
            _log: log
          }),
        'to be fulfilled'
      ).then(() => {
        expect(
          MockModuleStats._instance.fetchDepedentsWithMetric,
          'to have a call satisfying',
          ['downloads']
        );
        expect(
          MockModuleStats.packageNamesByMagnitude,
          'to have a call satisfying',
          [{ foo: 'bar' }]
        );
        expect(log, 'to have a call satisfying', [expect.it('to be a string')]);
      });
    });
  });
});
