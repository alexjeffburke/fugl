const expect = require('unexpected');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

const LinkStrategy = require('../src/LinkStrategy');

describe('LinkStrategy', () => {
  const moduleDir = path.join(__dirname, 'module');
  const buildsFolder = path.join(moduleDir, 'builds');
  const toFolder = path.join(buildsFolder, 'example');
  const nodeModulesDir = path.join(toFolder, 'node_modules');

  beforeEach(() => {
    fsExtra.removeSync(buildsFolder);
  });

  it('should succeed linking into present node_modules', () => {
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    return expect(
      () => new LinkStrategy(moduleDir).installTo({ toFolder }),
      'to be fulfilled'
    ).then(() => {
      const stat = fs.lstatSync(path.join(nodeModulesDir, 'dont-break-foo'));
      expect(stat, 'to be an object');
      expect(stat.isSymbolicLink(), 'to be true');
    });
  });

  it('should succeed linking over existing link', () => {
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    // create a symlink
    fs.symlinkSync(
      path.join(__dirname, 'module'),
      path.join(nodeModulesDir, 'dont-break-foo')
    );

    return expect(
      () => new LinkStrategy(moduleDir).installTo({ toFolder }),
      'to be fulfilled'
    ).then(() => {
      const stat = fs.lstatSync(path.join(nodeModulesDir, 'dont-break-foo'));
      expect(stat, 'to be an object');
      expect(stat.isSymbolicLink(), 'to be true');
    });
  });

  it('should error linking into missing node_modules', () => {
    return expect(
      () => new LinkStrategy(moduleDir).installTo({ toFolder }),
      'to be rejected with',
      'Link Failure: cannot link into missing node_modules'
    );
  });

  describe('when the package has binaries', () => {
    it('should link the binaries into node_modules', () => {
      const moduleWithBinariesDir = path.join(
        __dirname,
        'module-with-binaries'
      );
      const buildsFolder = path.join(moduleWithBinariesDir, 'builds');
      const toFolder = path.join(buildsFolder, 'example');
      const nodeModulesDir = path.join(toFolder, 'node_modules');

      // create folder
      fsExtra.mkdirpSync(nodeModulesDir);

      return expect(
        () => new LinkStrategy(moduleWithBinariesDir).installTo({ toFolder }),
        'to be fulfilled'
      )
        .then(() => {
          // check the link was created
          const linkedBinPath = path.join(nodeModulesDir, '.bin', 'bin1');
          const stat = fs.lstatSync(linkedBinPath);
          expect(stat, 'to be an object');
          expect(stat.isSymbolicLink(), 'to be true');

          // check the link was correct
          const realPath = fs.realpathSync(linkedBinPath);
          const originalBinPath = path.join(moduleWithBinariesDir, 'bin1.js');
          expect(realPath, 'to equal', originalBinPath);
        })
        .finally(() => {
          fsExtra.removeSync(buildsFolder);
        });
    });
  });
});
