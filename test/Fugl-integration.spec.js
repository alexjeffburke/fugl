const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'))
  .use(require('unexpected-snapshot'));
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const sinon = require('sinon');
const spawn = require('cross-spawn');

const Fugl = require('../src/Fugl');

function createAndRunFugl(options) {
  try {
    return new Fugl(options).run();
  } catch (error) {
    return Promise.reject(error);
  }
}

function toLines(spy) {
  const lines = [];
  for (const call of spy.getCalls()) {
    const { args } = call;
    const msg = args.length > 0 ? args[0] : '';
    lines.push(`${msg}\n`);
  }
  return lines;
}

describe('Fugl @integration', () => {
  const cwd = path.join(__dirname, 'scratch');

  beforeEach(() => {
    return fsExtra.remove(cwd);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('when supplied module', () => {
    const dir = path.join(
      cwd,
      'builds',
      'https-github-com-bahmutov-dont-break-bar-git'
    );

    it('should have created the module folder', () => {
      return createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'none',
        folder: cwd,
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(stats => {
        expect(stats, 'to satisfy', { passes: 1 });
        expect(fs.existsSync(dir), 'to be true');
        expect(fs.existsSync(path.join(dir, 'package.json')), 'to be true');
      });
    });
  });

  describe('when supplied module and noClean', () => {
    const dir = path.join(
      cwd,
      'builds',
      'https-github-com-bahmutov-dont-break-bar-git'
    );
    const file = path.join(dir, 'test-file-in-checkout');

    beforeEach(() => {
      fsExtra.ensureDirSync(dir);

      spawn.sync(
        'git',
        ['clone', 'https://github.com/bahmutov/dont-break-bar.git', '.'],
        {
          cwd: dir
        }
      );

      // write a file that should persist across execution
      fs.writeFileSync(file, '');
    });

    it('should have created the module folder', () => {
      return createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'none',
        noClean: true,
        folder: cwd,
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        expect(fs.existsSync(dir), 'to be true');
        // the file should still be there if noClean applied correctly
        expect(fs.existsSync(file), 'to be true');
      });
    });
  });

  describe('when used within a package', () => {
    const pkg = path.join(__dirname, 'module');
    const dir = path.join(
      cwd,
      'builds',
      'https-github-com-bahmutov-dont-break-bar-git'
    );

    it('should have created the project folder', () => {
      return createAndRunFugl({
        reporter: 'none',
        package: pkg,
        packageInstaller: 'link',
        folder: cwd,
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        expect(fs.existsSync(dir), 'to be true');
      });
    });

    it('should have linked the package folder', () => {
      return createAndRunFugl({
        reporter: 'none',
        package: pkg,
        packageInstaller: 'link',
        folder: cwd,
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        const stat = fs.lstatSync(
          path.join(dir, 'node_modules', 'dont-break-foo')
        );
        expect(stat, 'to be an object');
        expect(stat.isSymbolicLink(), 'to be true');
      });
    });
  });

  const isNode10 = /^v10\./.test(process.version);
  const isCiWindows =
    process.env.GITHUB_ACTIONS === 'true' && process.platform === 'win32';

  describe('when reporting with console', () => {
    it('should output to stdout on a pass', async function() {
      if (isCiWindows && isNode10) {
        this.skip();
      }

      const pkg = path.join(__dirname, 'integration-test-pass');
      const fakeConsole = {
        log: sinon.stub().named('console.log')
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: pkg,
        packageInstaller: 'link',
        reporter: 'console',
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      });

      expect(toLines(fakeConsole.log), 'to equal snapshot', [
        '\n',
        '  https://github.com/alexjeffburke/fugl-test-project PASSED\n'
      ]);
    });

    it('should output to stdout on a fail', async () => {
      const pkg = path.join(__dirname, 'integration-test-fail');
      const fakeConsole = {
        log: sinon.stub().named('console.log')
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: pkg,
        packageInstaller: 'link',
        reporter: 'console',
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      });

      expect(toLines(fakeConsole.log), 'to satisfy', [
        '\n',
        '  https://github.com/alexjeffburke/fugl-test-project FAILED\n',
        /^Error: Test Failure/
      ]);
    });

    it('should output to stdout on a fail (pretest)', async () => {
      const pkg = path.join(__dirname, 'integration-test-fail');
      const fakeConsole = {
        log: sinon.stub().named('console.log')
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: pkg,
        packageInstaller: 'link',
        pretest: true,
        reporter: 'console',
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project-bar']
      });

      expect(toLines(fakeConsole.log), 'to satisfy', [
        '\n',
        '  https://github.com/alexjeffburke/fugl-test-project-bar (pretest) FAILED\n',
        /^Error: Test Failure/
      ]);
    });

    it('should output to stdout on a skip', async () => {
      const pkg = path.join(__dirname, 'integration-test-fail');
      const fakeConsole = {
        log: sinon.stub().named('console.log')
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: pkg,
        packageInstaller: 'link',
        pretest: true,
        pretestOrIgnore: true,
        reporter: 'console',
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project-bar']
      });

      expect(toLines(fakeConsole.log), 'to equal snapshot', [
        '\n',
        '  https://github.com/alexjeffburke/fugl-test-project-bar (skipped) SKIPPED\n'
      ]);
    });
  });

  describe('when reporting with none', () => {
    it('should not output', async () => {
      const fakeConsole = {
        log: sinon.stub().named('console.log'),
        warn: sinon.stub().named('console.warn')
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: 'dont-break-foo',
        reporter: 'none',
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      });

      expect(fakeConsole.log, 'was not called');
      expect(fakeConsole.warn, 'was not called');
    });

    it('should output to stderr when ci=true', async () => {
      const fakeConsole = {
        warn: sinon.stub().named('console.warn')
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: 'dont-break-foo',
        reporter: 'none',
        ci: true,
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      });

      expect(toLines(fakeConsole.warn), 'to equal snapshot', [
        '\n',
        '  https://github.com/alexjeffburke/fugl-test-project PASSED\n'
      ]);
    });
  });

  describe('when reporting with html', () => {
    it('should have written an HTML report', async () => {
      await createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'html',
        folder: cwd,
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      });

      const file = path.join(cwd, 'breakage', 'index.html');
      expect(fs.existsSync(file), 'to be true');
    });
  });

  describe('when reporting with spec', () => {
    it('should output to stdout', async () => {
      const reporterBaseClass = require('mocha/lib/reporters/base');
      const logStub = sinon.stub(reporterBaseClass, 'consoleLog');
      const fakeConsole = {
        log: logStub
      };

      await createAndRunFugl({
        _cons: fakeConsole,
        package: 'dont-break-foo',
        reporter: 'spec',
        folder: cwd,
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      });

      expect(fakeConsole.log, 'was called');
    });
  });
});
