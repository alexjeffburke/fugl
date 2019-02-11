const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const rimraf = require('rimraf');
const sinon = require('sinon');

const Fugl = require('../src/Fugl');
const LinkStrategy = require('../src/LinkStrategy');
const NpmStrategy = require('../src/NpmStrategy');

describe('Fugl', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'scratch', 'builds'));
  });

  it('should error with missing options', () => {
    return expect(
      () => {
        new Fugl();
      },
      'to throw',
      'Fugl: missing options'
    );
  });

  it('should error with missing package', () => {
    return expect(
      () => {
        new Fugl({});
      },
      'to throw',
      'Fugl: missing package'
    );
  });

  it('should error with missing folder', () => {
    return expect(
      () => {
        new Fugl({ package: 'somepackage' });
      },
      'to throw',
      'Fugl: missing folder'
    );
  });

  it('should error with missing projects', () => {
    return expect(
      () => {
        new Fugl({ package: 'somepackage', folder: __dirname });
      },
      'to throw',
      'Fugl: missing projects'
    );
  });

  it('should error with invalid projects', () => {
    return expect(
      () => {
        new Fugl({ package: 'somepackage', folder: __dirname, projects: {} });
      },
      'to throw',
      'Fugl: missing projects'
    );
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
      pretestOrIgnore: false,
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
      projects: []
    });
  });

  it('should instantiate installer (npm)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      projects: []
    });

    return expect(
      fugl.packageInstaller,
      expect.it('to be a', NpmStrategy).and('to satisfy', {
        packageName: 'somepackage',
        packageVersion: 'latest'
      })
    );
  });

  it('should instantiate installer (link)', () => {
    const fugl = new Fugl({
      package: path.join(__dirname, '..'),
      packageInstaller: 'link',
      folder: __dirname,
      projects: []
    });

    return expect(
      fugl.packageInstaller,
      expect.it('to be a', LinkStrategy).and('to satisfy', {
        packagePath: path.join(__dirname, '..'),
        packageName: 'fugl'
      })
    );
  });

  it('should error on an unsuported installer', () => {
    return expect(
      () => {
        new Fugl({
          package: path.join(__dirname, '..'),
          packageInstaller: 'other',
          folder: __dirname,
          projects: []
        });
      },
      'to throw',
      'Fugl: unsupported package installer other'
    );
  });

  it('should return stats on a pass', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['FOO']
    });
    sinon.stub(fugl, 'installDependent').resolves();
    sinon.stub(fugl, 'testDependent').resolves({
      pretest: { status: 'pass' },
      packagetest: { status: 'pass' }
    });

    return expect(() => fugl.run(), 'to be fulfilled with', {
      passes: 1,
      failures: 0
    });
  });

  it('should return stats on a fail (installDependent)', () => {
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
          pretestOrIgnore: false,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          packageInstaller: expect.it('to be a', NpmStrategy),
          moduleName: 'FOO',
          toFolder: path.join(__dirname, 'builds', 'foo')
        },
        {
          pretest: true,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ]);
    });
  });

  it('should return stats on a fail (testDependent)', () => {
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
          pretestOrIgnore: false,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          packageInstaller: expect.it('to be a', NpmStrategy),
          moduleName: 'FOO',
          toFolder: path.join(__dirname, 'builds', 'foo')
        },
        {
          pretest: true,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ]);
    });
  });

  it('should return stats on a fail (event)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['FOO'],
      pretest: false
    });
    sinon.stub(fugl, 'installDependent').resolves();
    const testDependentStub = sinon.stub(fugl, 'testDependent').resolves({
      packagetest: {
        status: 'fail',
        error: new Error('bad times')
      }
    });

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
          pretest: false,
          pretestOrIgnore: false,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          packageInstaller: expect.it('to be a', NpmStrategy),
          moduleName: 'FOO',
          toFolder: path.join(__dirname, 'builds', 'foo')
        },
        {
          pretest: false,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ]);
    });
  });

  it('should emit failure on a fail (event)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['FOO'],
      pretest: false
    });
    const emitSpy = sinon.spy(fugl, 'emit');
    sinon.stub(fugl, 'installDependent').resolves();
    const packageTestError = new Error('bad times');
    sinon.stub(fugl, 'testDependent').resolves({
      packagetest: {
        status: 'fail',
        error: packageTestError
      }
    });

    return expect(fugl.run(), 'to be fulfilled with', {
      passes: 0,
      failures: 1
    }).then(() => {
      expect(emitSpy, 'to have a call satisfying', {
        args: ['fail', { title: 'FOO' }, packageTestError]
      });
    });
  });

  describe('when using pretestOrIgnore', () => {
    it('should throw if missing pretest', () => {
      return expect(
        () => {
          new Fugl({
            package: 'somepackage',
            folder: __dirname,
            reporter: 'none',
            projects: ['FOO'],
            pretest: false,
            pretestOrIgnore: true
          });
        },
        'to throw',
        'Fugl: cannot pretestOrIgnore without pretest'
      );
    });

    it('should emit pending on a pretest fail', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['FOO'],
        pretest: true,
        pretestOrIgnore: true
      });
      const emitSpy = sinon.spy(fugl, 'emit');
      sinon.stub(fugl, 'installDependent').resolves();
      sinon.stub(fugl, 'testDependent').resolves({
        pretest: {
          status: 'pending'
        }
      });

      return expect(fugl.run(), 'to be fulfilled with', {
        passes: 0,
        failures: 0,
        skipped: 1
      }).then(() => {
        expect(emitSpy, 'to have a call satisfying', {
          args: ['pending', { title: 'FOO (skipped)' }]
        });
      });
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
              return Promise.resolve({ packagetest: { status: 'pass' } });
            case 2:
              return Promise.resolve({ packagetest: { status: 'fail' } });
            case 3:
              return Promise.resolve({ packagetest: { status: 'pass' } });
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
      const testDependentStub = sinon.stub(fugl, 'testDependent').resolves({
        pretest: {
          status: 'pass'
        },
        packagetest: {
          status: 'pass'
        }
      });

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
              pretestOrIgnore: false,
              reportDir: path.join(__dirname, 'breakage'),
              tmpDir: path.join(__dirname, 'builds'),
              packageInstaller: expect.it('to be a', NpmStrategy),
              moduleName: 'FOO',
              toFolder: path.join(__dirname, 'builds', 'foo')
            },
            {
              pretest: true,
              projects: [{ name: 'FOO' }],
              name: 'FOO'
            }
          ]
        ]);
      });
    });

    it('should return a single failure if the pretest fails', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['FOO']
      });
      sinon.stub(fugl, 'installDependent').resolves();
      const testDependentStub = sinon.stub(fugl, 'testDependent').resolves({
        pretest: {
          status: 'fail'
        },
        packagetest: {
          status: 'pass'
        }
      });

      return expect(() => fugl.run(), 'to be fulfilled with', {
        passes: 0,
        failures: 1
      }).then(() => {
        expect(testDependentStub, 'to have calls exhaustively satisfying', [
          [
            {
              package: 'somepackage',
              folder: __dirname,
              reporter: 'none',
              noClean: false,
              pretest: true,
              pretestOrIgnore: false,
              reportDir: path.join(__dirname, 'breakage'),
              tmpDir: path.join(__dirname, 'builds'),
              packageInstaller: expect.it('to be a', NpmStrategy),
              moduleName: 'FOO',
              toFolder: path.join(__dirname, 'builds', 'foo')
            },
            {
              pretest: true,
              projects: [{ name: 'FOO' }],
              name: 'FOO'
            }
          ]
        ]);
      });
    });

    it('should emit a single failure if the pretest fails', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['FOO']
      });
      const emitSpy = sinon.spy(fugl, 'emit');
      sinon.stub(fugl, 'installDependent').resolves();
      const pretestError = new Error('pretest error');
      sinon.stub(fugl, 'testDependent').resolves({
        pretest: {
          status: 'fail',
          error: pretestError
        },
        packagetest: {
          status: 'pass'
        }
      });

      return expect(() => fugl.run(), 'to be fulfilled with', {
        passes: 0,
        failures: 1
      }).then(() => {
        expect(emitSpy, 'to have a call satisfying', {
          args: ['fail', { title: 'FOO (pretest)' }, pretestError]
        });
      });
    });
  });

  describe('when supplying projects', () => {
    it('should allow project objects with specific options', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: [{ name: 'FOO', pretest: true }],
        pretest: false
      });
      sinon.stub(fugl, 'installDependent').resolves();
      const testDependentStub = sinon.stub(fugl, 'testDependent').resolves({
        packagetest: {
          status: 'pass'
        }
      });

      return expect(() => fugl.run(), 'to be fulfilled with', {
        passes: 1,
        failures: 0
      }).then(() => {
        expect(testDependentStub, 'to have calls satisfying', [
          [
            {},
            {
              name: 'FOO',
              pretest: true
            }
          ]
        ]);
      });
    });
  });

  describe('when supplying options', () => {
    it('should allow reporter', () => {
      const baseDir = path.resolve(__dirname);
      const fugl = new Fugl({
        package: 'somepackage',
        folder: baseDir,
        projects: [],
        reporter: 'spec'
      });

      expect(fugl.options, 'to satisfy', { reporter: 'spec' });
    });

    it('should allow pretest', () => {
      const baseDir = path.resolve(__dirname);
      const fugl = new Fugl({
        package: 'somepackage',
        folder: baseDir,
        projects: [],
        pretest: false
      });

      expect(fugl.options, 'to satisfy', { pretest: false });
    });

    it('should allow reportDir', () => {
      const baseDir = path.resolve(__dirname);
      const reportDir = path.join(baseDir, 'report');
      const fugl = new Fugl({
        package: 'somepackage',
        folder: baseDir,
        projects: [],
        reportDir
      });

      expect(fugl.options, 'to satisfy', { reportDir });
    });

    it('should allow tmpDir', () => {
      const baseDir = path.resolve(__dirname);
      const tmpDir = path.join(baseDir, 'tmp');
      const fugl = new Fugl({
        package: 'somepackage',
        folder: baseDir,
        projects: [],
        tmpDir
      });

      expect(fugl.options, 'to satisfy', { tmpDir });
    });
  });
});
