const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const rimraf = require('rimraf');
const sinon = require('sinon');

const Fugl = require('../src/Fugl');

describe('Fugl', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'scratch', 'builds'));
  });

  it('should default options', () => {
    const baseDir = path.resolve(__dirname);
    const fugl = new Fugl({
      package: 'somepackage',
      folder: baseDir,
      projects: []
    });

    return expect(fugl.options, 'to equal', {
      package: 'somepackage',
      reporter: 'console',
      folder: baseDir,
      noClean: false,
      pretest: true,
      reportDir: path.join(baseDir, 'breakage'),
      tmpDir: path.join(baseDir, 'builds')
    });
  });

  it('should populate config', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      projects: []
    });

    return expect(fugl.config, 'to equal', {
      packageName: 'somepackage',
      packageVersion: 'latest',
      projects: []
    });
  });

  it('should return stats on a pass', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['FOO']
    });
    sinon.stub(fugl, 'installDependent').resolves();
    sinon.stub(fugl, 'testDependent').resolves();

    return expect(() => fugl.run(), 'to be fulfilled with', {
      passes: 1,
      failures: 0
    });
  });

  it('should return stats on a fail', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['FOO']
    });
    const error = new Error('bad times');
    const installDependentStub = sinon
      .stub(fugl, 'installDependent')
      .rejects(error);

    return expect(fugl.run(), 'to be fulfilled with', {
      passes: 0,
      failures: 1
    }).then(() => {
      expect(installDependentStub, 'to have a call exhaustively satisfying', [
        {
          package: 'somepackage',
          folder: __dirname,
          reporter: 'none',
          noClean: false,
          pretest: true,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          moduleName: 'FOO',
          toFolder: path.join(__dirname, 'builds', 'foo')
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest',
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ]);
    });
  });

  it('should return stats on a fail', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['FOO']
    });
    sinon.stub(fugl, 'installDependent').resolves();
    const error = new Error('bad times');
    const testDependentStub = sinon.stub(fugl, 'testDependent').rejects(error);

    return expect(fugl.run(), 'to be fulfilled with', {
      passes: 0,
      failures: 1
    }).then(() => {
      expect(testDependentStub, 'to have a call exhaustively satisfying', [
        {
          package: 'somepackage',
          folder: __dirname,
          reporter: 'none',
          noClean: false,
          pretest: true,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          moduleName: 'FOO',
          toFolder: path.join(__dirname, 'builds', 'foo')
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest',
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ]);
    });
  });

  describe('with multiple dependents', () => {
    it('should return stats on a pass', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['FOO', 'BAR', 'BAZ']
      });
      sinon.stub(fugl, 'installDependent').resolves();
      let testDependentCallCount = 0;
      const testDependentStub = sinon
        .stub(fugl, 'testDependent')
        .callsFake(() => {
          testDependentCallCount += 1;

          switch (testDependentCallCount) {
            case 1:
              return Promise.resolve();
            case 2:
              return Promise.reject(new Error('failure'));
            case 3:
              return Promise.resolve();
          }
        });

      return expect(() => fugl.run(), 'to be fulfilled with', {
        passes: 2,
        failures: 1
      }).then(() => {
        expect(testDependentStub, 'to have calls satisfying', [
          [{}, { name: 'FOO', pretest: true }],
          [{}, { name: 'BAR', pretest: true }],
          [{}, { name: 'BAZ', pretest: true }]
        ]);
      });
    });
  });

  describe('with customised test execution config', () => {
    it('should include script overrides', () => {
      const fugl = new Fugl({
        package: 'package-and-overrides',
        folder: __dirname,
        projects: [],
        config: {
          install: 'INSTALL',
          postinstall: 'POSTINSTALL',
          test: 'TEST'
        }
      });
      const testDependentsStub = sinon.stub(fugl, 'testDependents');
      testDependentsStub.resolves({ passes: 123, failure: 456 });

      return expect(() => fugl.run(), 'to be fulfilled with', {
        passes: 123,
        failure: 456
      }).then(() => {
        expect(fugl.config, 'to satisfy', {
          packageName: 'package-and-overrides',
          packageVersion: 'latest',
          install: 'INSTALL',
          postinstall: 'POSTINSTALL',
          test: 'TEST'
        });
      });
    });
  });

  describe('with pretest', () => {
    it('should return stats on a pass', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['FOO']
      });
      sinon.stub(fugl, 'installDependent').resolves();
      const testDependentStub = sinon.stub(fugl, 'testDependent').resolves();

      return expect(() => fugl.run(), 'to be fulfilled with', {
        passes: 1,
        failures: 0
      }).then(() => {
        expect(testDependentStub, 'to have calls exhaustively satisfying', [
          [
            {
              package: 'somepackage',
              folder: __dirname,
              reporter: 'none',
              noClean: false,
              pretest: true,
              reportDir: path.join(__dirname, 'breakage'),
              tmpDir: path.join(__dirname, 'builds'),
              moduleName: 'FOO',
              toFolder: path.join(__dirname, 'builds', 'foo')
            },
            {
              pretest: true,
              packageName: 'somepackage',
              packageVersion: 'latest',
              projects: [{ name: 'FOO' }],
              name: 'FOO'
            }
          ]
        ]);
      });
    });
  });
});
