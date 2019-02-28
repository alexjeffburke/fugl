const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const cli = require('../src/cli');
const Project = require('../src/Project');

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
    fetchDependents: sinon.stub().named('fetchDependents'),
    fetchMetricForProjects: sinon.stub().named('fetchMetricForProjects')
  };
  MockModuleStats.packageNamesByMagnitude = sinon
    .stub()
    .named('packageNamesByMagnitude');

  return MockModuleStats.callsFake(() => MockModuleStats._instance);
}

expect.addAssertion('<string> to be JSON', (expect, subject) => {
  expect(() => {
    return JSON.parse(subject);
  }, 'not to error');
});

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

    describe('with options', () => {
      it('should handle --ci', () => {
        const MockFugl = createMockFugl();
        MockFugl._instance.run.rejects(new Error('bail'));
        const args = {
          package: 'somepackage',
          ci: true
        };

        return expect(
          () =>
            cli.check('/some/path', args, {
              _Fugl: MockFugl
            }),
          'to be rejected'
        ).then(() => {
          expect(MockFugl, 'to have a call satisfying', [{ ci: true }]);
        });
      });
    });
  });

  describe('fetch', () => {
    it('should construct ModuleStats', () => {
      const MockModuleStats = createMockModuleStats();
      MockModuleStats._instance.fetchDependents.rejects(new Error('fail'));
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
      MockModuleStats._instance.fetchDependents.resolves(['foo']);
      MockModuleStats._instance.fetchMetricForProjects.resolves({
        foo: 'bar'
      });
      MockModuleStats.packageNamesByMagnitude.resolves(['somedependent']);
      const args = {};

      return expect(
        () =>
          cli.fetch(null, args, {
            _ModuleStats: MockModuleStats,
            _log: () => {}
          }),
        'to be fulfilled'
      ).then(() => {
        expect(
          MockModuleStats._instance.fetchMetricForProjects,
          'to have a call satisfying',
          [
            'downloads',
            expect.it('to have items satisfying', 'to be a', Project)
          ]
        );
        expect(
          MockModuleStats.packageNamesByMagnitude,
          'to have a call satisfying',
          [{ foo: 'bar' }]
        );
      });
    });

    it('should output dependents data to stdout', () => {
      const MockModuleStats = createMockModuleStats();
      MockModuleStats._instance.fetchDependents.resolves(['foo']);
      MockModuleStats._instance.fetchMetricForProjects.resolves({
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
        expect(log, 'to have a call satisfying', [
          expect.it('to be a string').and('to be JSON')
        ]);
      });
    });
  });
});
