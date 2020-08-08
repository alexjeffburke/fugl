const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const rimraf = require('rimraf');
const sinon = require('sinon');

const Fugl = require('../src/Fugl');
const LinkStrategy = require('../src/LinkStrategy');
const NpmStrategy = require('../src/NpmStrategy');
const Project = require('../src/Project');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  it('should error with missing projects (non-array)', () => {
    return expect(
      () => {
        new Fugl({ package: 'somepackage', folder: __dirname, projects: {} });
      },
      'to throw',
      'Fugl: missing projects'
    );
  });

  it('should error with an invalid timeout', () => {
    return expect(
      () => {
        new Fugl({
          package: 'somepackage',
          folder: __dirname,
          projects: [],
          timeout: NaN
        });
      },
      'to throw',
      'Fugl: invalid timeout'
    );
  });

  it('should error with invalid project', () => {
    return expect(
      () => {
        new Fugl({ package: 'somepackage', folder: __dirname, projects: [1] });
      },
      'to throw',
      'Fugl: project supplied without name'
    );
  });

  it('should error with project missing name', () => {
    return expect(
      () => {
        new Fugl({ package: 'somepackage', folder: __dirname, projects: [{}] });
      },
      'to throw',
      'Fugl: project supplied without name'
    );
  });

  it('should error with project name that is not a repository', () => {
    return expect(
      () => {
        new Fugl({
          package: 'somepackage',
          folder: __dirname,
          projects: ['@FOO']
        });
      },
      'to throw',
      'Fugl: project @FOO is not a repository'
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
      ci: false,
      noClean: false,
      pretest: true,
      pretestOrIgnore: false,
      reportDir: path.join(baseDir, 'breakage'),
      tmpDir: path.join(baseDir, 'builds')
    });
  });

  it('should allow options', () => {
    const baseDir = path.resolve(__dirname);
    const fugl = new Fugl({
      package: 'somepackage',
      folder: baseDir,
      projects: [],
      ci: true,
      noClean: true
    });

    return expect(fugl.options, 'to equal', {
      package: 'somepackage',
      reporter: 'console',
      folder: baseDir,
      ci: true,
      noClean: true,
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

  it('should populate config (.git suffix)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      projects: ['https://host/foo.git']
    });

    return expect(fugl.config, 'to equal', {
      projects: [new Project({ name: 'https://host/foo.git' })]
    });
  });

  it('should populate config (no .git suffix)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      projects: ['https://host/foo']
    });

    return expect(fugl.config, 'to equal', {
      projects: [new Project({ name: 'https://host/foo' })]
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

  it('should error when run() is called with no projects', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: []
    });

    return expect(
      () => fugl.run(),
      'to be rejected with',
      'Fugl: no projects specified'
    );
  });

  it('should return stats on a pass', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['https://service.tld/foo.git']
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

  it('should emit on a pass (git)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['https://service.tld/foo.git']
    });
    sinon.stub(fugl, 'installDependent').returns(delay(100));
    sinon.stub(fugl, 'testDependent').resolves({
      pretest: { status: 'pass' },
      packagetest: { status: 'pass' }
    });
    const emitSpy = sinon.spy(fugl, 'emit');

    return expect(() => fugl.run(), 'to be fulfilled with', {
      passes: 1,
      failures: 0,
      skipped: 0
    }).then(() => {
      expect(emitSpy, 'to have calls satisfying', [
        ['start'],
        ['test begin', {}],
        [
          'pass',
          {
            title: 'https://service.tld/foo.git',
            duration: expect.it('to be greater than or equal to', 95),
            isPending: expect.it('when called', 'to equal', false)
          }
        ],
        ['test end', {}],
        ['end']
      ]);
    });
  });

  it('should emit on a pass (npm)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['somepackage-plugin-foo']
    });
    const repoUrl = 'https://service.tld/plugin.git';
    sinon.stub(fugl, 'checkProject').callsFake(() => {
      // fake the project repoUrl being updated on verification
      fugl.config.projects[0].shoulderProject.repoUrl = repoUrl;
      // now complete the operation
      return Promise.resolve();
    });
    const installDependent = sinon.stub(fugl, 'installDependent').resolves();
    sinon.stub(fugl, 'testDependent').resolves({
      pretest: { status: 'pass' },
      packagetest: { status: 'pass' }
    });
    const emitSpy = sinon.spy(fugl, 'emit');

    return expect(() => fugl.run(), 'to be fulfilled').then(() => {
      expect(installDependent, 'to have a call satisfying', [
        {
          moduleName: repoUrl,
          toFolder: path.join(
            __dirname,
            'builds',
            'https-service-tld-plugin-git'
          )
        },
        {
          name: repoUrl
        }
      ]);
      expect(emitSpy, 'to have calls satisfying', [
        ['start'],
        ['test begin', {}],
        [
          'pass',
          {
            title: 'somepackage-plugin-foo',
            duration: expect.it('to be greater than or equal to', 0),
            isPending: expect.it('when called', 'to equal', false)
          }
        ],
        ['test end', {}],
        ['end']
      ]);
    });
  });

  it('should return stats on a fail (installDependent)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['https://service.tld/foo.git']
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
          ci: false,
          noClean: false,
          pretest: true,
          pretestOrIgnore: false,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          packageInstaller: expect.it('to be a', NpmStrategy),
          moduleName: 'https://service.tld/foo.git',
          toFolder: path.join(__dirname, 'builds', 'https-service-tld-foo-git')
        },
        {
          pretest: true,
          projects: expect.it('to equal', fugl.config.projects),
          name: 'https://service.tld/foo.git'
        }
      ]);
    });
  });

  it('should return stats on a fail (testDependent)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['https://service.tld/foo.git']
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
          ci: false,
          noClean: false,
          pretest: true,
          pretestOrIgnore: false,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          packageInstaller: expect.it('to be a', NpmStrategy),
          moduleName: 'https://service.tld/foo.git',
          toFolder: path.join(__dirname, 'builds', 'https-service-tld-foo-git')
        },
        {
          pretest: true,
          projects: expect.it('to equal', fugl.config.projects),
          name: 'https://service.tld/foo.git'
        }
      ]);
    });
  });

  it('should return stats on a fail (event)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['https://service.tld/foo.git'],
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
          ci: false,
          noClean: false,
          pretest: false,
          pretestOrIgnore: false,
          reportDir: path.join(__dirname, 'breakage'),
          tmpDir: path.join(__dirname, 'builds'),
          packageInstaller: expect.it('to be a', NpmStrategy),
          moduleName: 'https://service.tld/foo.git',
          toFolder: path.join(__dirname, 'builds', 'https-service-tld-foo-git')
        },
        {
          pretest: false,
          projects: expect.it('to equal', fugl.config.projects),
          name: 'https://service.tld/foo.git'
        }
      ]);
    });
  });

  it('should emit failure on a fail (checkProject)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['somepackage']
    });
    const error = new Error('bad times');
    const checkProject = sinon.stub(fugl, 'checkProject').rejects(error);
    const emitSpy = sinon.spy(fugl, 'emit');

    return expect(fugl.run(), 'to be fulfilled with', {
      passes: 0,
      failures: 1
    }).then(() => {
      expect(checkProject, 'to have a call satisfying', [
        new Project({ name: 'somepackage', kind: 'npm', repoUrl: null })
      ]);
      expect(emitSpy, 'to have calls satisfying', [
        ['start'],
        ['test begin', {}],
        ['fail', { title: 'somepackage' }, error],
        ['test end', {}],
        ['end']
      ]);
    });
  });

  it('should emit failure on a fail (event)', () => {
    const fugl = new Fugl({
      package: 'somepackage',
      folder: __dirname,
      reporter: 'none',
      projects: ['https://service.tld/foo.git'],
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
      expect(emitSpy, 'to have calls satisfying', [
        ['start'],
        ['test begin', {}],
        ['fail', { title: 'https://service.tld/foo.git' }, packageTestError],
        ['test end', {}],
        ['end']
      ]);
    });
  });

  describe('#checkProject', () => {
    it('should call verify the project has a repoUrl', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['https://service.tld/foo.git'],
        pretest: false
      });
      const project = {
        verify: sinon
          .stub()
          .named('verify')
          .resolves()
      };

      return expect(fugl.checkProject(project), 'to be fulfilled').then(() => {
        expect(project.verify, 'to have a call satisfying', ['repoUrl']);
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
            projects: ['https://service.tld/foo.git'],
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
        projects: ['https://service.tld/foo.git'],
        pretest: true,
        pretestOrIgnore: true
      });
      const emitSpy = sinon.spy(fugl, 'emit');
      sinon.stub(fugl, 'installDependent').returns(delay(100));
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
        expect(emitSpy, 'to have calls satisfying', [
          ['start'],
          ['test begin', {}],
          [
            'pending',
            {
              title: 'https://service.tld/foo.git (skipped)',
              duration: expect.it('to be greater than or equal to', 95),
              isPending: expect.it('when called', 'to equal', true)
            }
          ],
          ['test end', {}],
          ['end']
        ]);
      });
    });
  });

  describe('with multiple dependents', () => {
    it('should return stats on a pass', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: [
          'https://service.tld/foo.git',
          'https://service.tld/bar.git',
          'https://service.tld/baz.git'
        ]
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
          [{}, { name: 'https://service.tld/foo.git', pretest: true }],
          [{}, { name: 'https://service.tld/bar.git', pretest: true }],
          [{}, { name: 'https://service.tld/baz.git', pretest: true }]
        ]);
      });
    });
  });

  describe('with customised test execution config', () => {
    it('should include script overrides in config', () => {
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

    it('should pass script overrides to installDependent', () => {
      const fugl = new Fugl({
        package: 'package-and-overrides',
        folder: __dirname,
        projects: ['https://service.tld/foo'],
        reporter: 'none',
        config: {
          install: 'INSTALL',
          postinstall: 'POSTINSTALL',
          test: 'TEST'
        }
      });
      sinon.stub(fugl, 'checkProject').resolves();
      const installDependentStub = sinon
        .stub(fugl, 'installDependent')
        .rejects(new Error());

      return expect(() => fugl.run(), 'to be fulfilled').then(() => {
        expect(installDependentStub, 'to have a call satisfying', [
          {},
          {
            name: 'https://service.tld/foo',
            install: 'INSTALL',
            postinstall: 'POSTINSTALL',
            test: 'TEST'
          }
        ]);
      });
    });

    it('should pass script overrides to testDependent', () => {
      const fugl = new Fugl({
        package: 'package-and-overrides',
        folder: __dirname,
        projects: ['https://service.tld/foo'],
        reporter: 'none',
        config: {
          install: 'INSTALL',
          postinstall: 'POSTINSTALL',
          test: 'TEST'
        }
      });
      sinon.stub(fugl, 'checkProject').resolves();
      sinon.stub(fugl, 'installDependent').resolves();
      const testDependentStub = sinon
        .stub(fugl, 'testDependent')
        .rejects(new Error());

      return expect(() => fugl.run(), 'to be fulfilled').then(() => {
        expect(testDependentStub, 'to have a call satisfying', [
          {},
          {
            name: 'https://service.tld/foo',
            install: 'INSTALL',
            postinstall: 'POSTINSTALL',
            test: 'TEST'
          }
        ]);
      });
    });
  });

  describe('with pretest', () => {
    it('should return stats on a pass', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: ['https://service.tld/foo.git']
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
              ci: false,
              noClean: false,
              pretest: true,
              pretestOrIgnore: false,
              reportDir: path.join(__dirname, 'breakage'),
              tmpDir: path.join(__dirname, 'builds'),
              packageInstaller: expect.it('to be a', NpmStrategy),
              moduleName: 'https://service.tld/foo.git',
              toFolder: path.join(
                __dirname,
                'builds',
                'https-service-tld-foo-git'
              )
            },
            {
              pretest: true,
              projects: expect.it('to equal', fugl.config.projects),
              name: 'https://service.tld/foo.git'
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
        projects: ['https://service.tld/foo.git']
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
              ci: false,
              noClean: false,
              pretest: true,
              pretestOrIgnore: false,
              reportDir: path.join(__dirname, 'breakage'),
              tmpDir: path.join(__dirname, 'builds'),
              packageInstaller: expect.it('to be a', NpmStrategy),
              moduleName: 'https://service.tld/foo.git',
              toFolder: path.join(
                __dirname,
                'builds',
                'https-service-tld-foo-git'
              )
            },
            {
              pretest: true,
              projects: expect.it('to equal', fugl.config.projects),
              name: 'https://service.tld/foo.git'
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
        projects: ['https://service.tld/foo.git']
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
        expect(emitSpy, 'to have calls satisfying', [
          ['start'],
          ['test begin', {}],
          [
            'fail',
            { title: 'https://service.tld/foo.git (pretest)' },
            pretestError
          ],
          ['test end', {}],
          ['end']
        ]);
      });
    });
  });

  describe('when supplying projects', () => {
    it('should allow project objects with specific options', () => {
      const fugl = new Fugl({
        package: 'somepackage',
        folder: __dirname,
        reporter: 'none',
        projects: [{ name: 'https://service.tld/foo.git', pretest: true }],
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
              name: 'https://service.tld/foo.git',
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

    it('should allow reportSuffix', () => {
      const baseDir = path.resolve(__dirname);
      const fugl = new Fugl({
        package: 'somepackage',
        folder: baseDir,
        projects: [],
        reportSuffix: 'report'
      });

      expect(fugl.options, 'to satisfy', {
        reportDir: path.join(baseDir, 'breakage', 'report')
      });
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

      expect(fugl.options, 'to satisfy', {
        tmpDir: path.join(tmpDir, 'builds')
      });
    });
  });
});
