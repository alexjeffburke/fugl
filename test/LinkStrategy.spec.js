const expect = require('unexpected');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');

const LinkStrategy = require('../src/LinkStrategy');

describe('LinkStrategy', () => {
  const moduleDir = path.join(__dirname, 'module');
  const buildsFolder = path.join(moduleDir, 'builds');
  const toFolder = path.join(buildsFolder, 'example');
  const nodeModulesDir = path.join(toFolder, 'node_modules');

  beforeEach(() => {
    rimraf.sync(buildsFolder);
  });

  it('should succeed linking into present node_modules', () => {
    mkdirp.sync(nodeModulesDir);

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
    mkdirp.sync(nodeModulesDir);
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
});