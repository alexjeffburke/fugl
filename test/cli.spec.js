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
          [expect.it('to begin with', 'builds located in')],
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
});
