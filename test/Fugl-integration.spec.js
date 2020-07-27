const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const simpleGit = require('simple-git/promise')();

const Fugl = require('../src/Fugl');

function createAndRunFugl(options) {
  try {
    return new Fugl(options).run();
  } catch (error) {
    return Promise.reject(error);
  }
}

describe('Fugl @integration', () => {
  describe('when supplied module', () => {
    const baseDir = path.join(__dirname, 'scratch', 'builds');
    const dir = path.join(
      baseDir,
      'https-github-com-bahmutov-dont-break-bar-git'
    );

    beforeEach(() => {
      rimraf.sync(baseDir);
    });

    it('should have created the module folder', () => {
      return createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'none',
        folder: path.join(__dirname, 'scratch'),
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        expect(fs.existsSync(dir), 'to be true');
      });
    });
  });

  describe('when supplied module and noClean', () => {
    const baseDir = path.join(__dirname, 'noclean', 'builds');
    const dir = path.join(
      baseDir,
      'https-github-com-bahmutov-dont-break-bar-git'
    );
    const file = path.join(dir, 'test-file-in-checkout');

    beforeEach(() => {
      rimraf.sync(baseDir);

      return simpleGit
        .clone('https://github.com/bahmutov/dont-break-bar.git', dir)
        .then(() => {
          // write a file that should persist across execution
          fs.writeFileSync(file, '');
        });
    });

    it('should have created the module folder', () => {
      return createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'none',
        noClean: true,
        folder: path.join(__dirname, 'noclean'),
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        expect(fs.existsSync(dir), 'to be true');
        // the file should still be there if noClean applied correctly
        expect(fs.existsSync(file), 'to be true');
      });
    });
  });

  describe('when used within a package', () => {
    const baseDir = path.join(path.join(__dirname, 'module', 'builds'));
    const dir = path.join(
      baseDir,
      'https-github-com-bahmutov-dont-break-bar-git'
    );

    beforeEach(() => {
      rimraf.sync(baseDir);
    });

    it('should have created the project folder', () => {
      const cwd = path.join(__dirname, 'module');

      return createAndRunFugl({
        reporter: 'none',
        package: cwd,
        packageInstaller: 'link',
        folder: cwd,
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        expect(fs.existsSync(dir), 'to be true');
      });
    });

    it('should have linked the package folder', () => {
      const cwd = path.join(__dirname, 'module');

      return createAndRunFugl({
        reporter: 'none',
        package: cwd,
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

  describe('when reporting with html', () => {
    beforeEach(() => {
      rimraf.sync(path.join(__dirname, 'html', 'breakage'));
      rimraf.sync(path.join(__dirname, 'html', 'builds'));
    });

    it('should have created the module folder', () => {
      return createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'html',
        folder: path.join(__dirname, 'html'),
        projects: ['https://github.com/bahmutov/dont-break-bar.git']
      }).then(() => {
        expect(
          fs.existsSync(path.join(__dirname, 'html', 'breakage', 'index.html')),
          'to be true'
        );
      });
    });
  });

  describe('when reporting with spec', () => {
    beforeEach(() => {
      rimraf.sync(path.join(__dirname, 'spec'));
    });

    it('should have created the module folder', () => {
      return createAndRunFugl({
        package: 'dont-break-foo',
        reporter: 'spec',
        folder: path.join(__dirname, 'spec'),
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      }).then(() => {
        expect(fs.existsSync(path.join(__dirname, 'spec')), 'to be true');
      });
    });
  });
});
