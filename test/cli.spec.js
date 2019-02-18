const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const cli = require('../src/cli');

function createMockFugl() {
  const MockFugl = sinon.stub().named('MockFugl');

  MockFugl._instance = {
    run: sinon.stub().named('run')
  };

  return MockFugl.callsFake(() => MockFugl._instance);
}

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
  describe('check', () => {
    it('should construct Fugl with passes', () => {
      const MockFugl = createMockFugl();
      MockFugl._instance.run.resolves({
        failures: 0
      });
      const exitStub = sinon.stub().named('process.exit');
      const warnStub = sinon.stub().named('console.warn');
      const args = {
        package: 'somepackage'
      };

      return expect(
        () =>
          cli.check('/some/path', args, {
            _Fugl: MockFugl,
            _exit: exitStub,
            _warn: warnStub
          }),
        'to be fulfilled'
      ).then(() => {
        expect(MockFugl, 'to have a call satisfying', [
          { package: 'somepackage', folder: '/some/path' }
        ]);
        expect(exitStub, 'to have a call satisfying', [0]);
      });
    });

    it('should construct Fugl with failures', () => {
      const MockFugl = createMockFugl();
      MockFugl._instance.run.resolves({
        failures: 1
      });
      const exitStub = sinon.stub().named('process.exit');
      const warnStub = sinon.stub().named('console.warn');
      const args = {
        package: 'somepackage'
      };

      return expect(
        () =>
          cli.check('/some/path', args, {
            _Fugl: MockFugl,
            _exit: exitStub,
            _warn: warnStub
          }),
        'to be fulfilled'
      ).then(() => {
        expect(MockFugl, 'to have a call satisfying', [
          { package: 'somepackage', folder: '/some/path' }
        ]);
        expect(exitStub, 'to have a call satisfying', [1]);
      });
    });

    it('should output with failures', () => {
      const MockFugl = createMockFugl();
      MockFugl._instance.run.resolves({
        failures: 1
      });
      const warnStub = sinon.stub().named('console.warn');
      const args = {
        package: 'somepackage'
      };

      return expect(
        () =>
          cli.check('/some/path', args, {
            _Fugl: MockFugl,
            _exit: () => {},
            _warn: warnStub
          }),
        'to be fulfilled'
      ).then(() => {
        expect(warnStub, 'to have calls satisfying', [
          [],
          ['completed with failures']
        ]);
      });
    });

    it('should exit with failures', () => {
      const MockFugl = createMockFugl();
      MockFugl._instance.run.resolves({
        failures: 1
      });
      const exitStub = sinon.stub().named('process.exit');
      const args = {
        package: 'somepackage'
      };

      return expect(
        () =>
          cli.check('/some/path', args, {
            _Fugl: MockFugl,
            _exit: exitStub,
            _warn: () => {}
          }),
        'to be fulfilled'
      ).then(() => {
        expect(exitStub, 'to have a call satisfying', [1]);
      });
    });

    it('should construct Fugl under npx', () => {
      const MockFugl = createMockFugl();
      MockFugl._instance.run.resolves({
        failures: 1
      });
      const exitStub = sinon.stub().named('process.exit');
      const warnStub = sinon.stub().named('console.warn');

      return expect(
        () =>
          cli.check(
            '/some/path',
            {},
            {
              _Fugl: MockFugl,
              _exit: exitStub,
              _warn: warnStub
            }
          ),
        'to be fulfilled'
      ).then(() => {
        expect(MockFugl, 'to have a call satisfying', [
          { package: '/some/path', packageInstaller: 'link' }
        ]);
        expect(exitStub, 'to have a call satisfying', [1]);
      });
    });
  });

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
