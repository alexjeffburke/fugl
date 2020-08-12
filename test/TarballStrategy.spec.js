const expect = require('unexpected');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

const TarballStrategy = require('../src/TarballStrategy');

describe('TarballStrategy', () => {
  const tarballPath = path.join(
    __dirname,
    'tarball',
    'fugl-test-project-0.0.1.tgz'
  );
  const tarballDir = path.dirname(tarballPath);
  const buildsFolder = path.join(tarballDir, 'builds');
  const toFolder = path.join(buildsFolder, 'example');
  const nodeModulesDir = path.join(toFolder, 'node_modules');

  beforeEach(() => {
    fsExtra.removeSync(buildsFolder);
  });

  it('should succeed extracting into present node_modules', () => {
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    return expect(
      () => new TarballStrategy(tarballPath).installTo({ toFolder }),
      'to be fulfilled'
    ).then(() => {
      const outputPath = path.join(nodeModulesDir, 'fugl-test-project');
      let stat;
      stat = fs.lstatSync(outputPath);
      expect(stat, 'to be an object');
      expect(stat.isDirectory(), 'to be true');
      stat = fs.lstatSync(path.join(outputPath, 'package.json'));
      expect(stat, 'to be an object');
      expect(stat.isFile(), 'to be true');
    });
  });

  it('should succeed extracting over existing link', () => {
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    // create pre-existing directory
    fsExtra.mkdirpSync(path.join(nodeModulesDir, 'fugl-test-project'));

    return expect(
      () => new TarballStrategy(tarballPath).installTo({ toFolder }),
      'to be fulfilled'
    ).then(() => {
      const stat = fs.lstatSync(path.join(nodeModulesDir, 'fugl-test-project'));
      expect(stat, 'to be an object');
      expect(stat.isDirectory(), 'to be true');
    });
  });

  it('should error extracting into missing node_modules', () => {
    return expect(
      () => new TarballStrategy(tarballPath).installTo({ toFolder }),
      'to be rejected with',
      'Tarball Failure: cannot link into missing node_modules'
    );
  });

  it('should error extracting into missing node_modules', () => {
    const testPath = path.join(tarballDir, 'foo-0.0.1.txt');
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    return expect(
      () => new TarballStrategy(testPath).installTo({ toFolder }),
      'to be rejected with',
      'Tarball Failure: unsupported extension ".txt"'
    );
  });

  it('should error extracting file with invalid extension', () => {
    const testPath = path.join(tarballDir, 'foo-0.0.1.txt');
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    return expect(
      () => new TarballStrategy(testPath).installTo({ toFolder }),
      'to be rejected with',
      'Tarball Failure: unsupported extension ".txt"'
    );
  });

  it('should error extracting file with invalid name', () => {
    const testPath = path.join(tarballDir, 'foo-0.0.txt');
    // create folder
    fsExtra.mkdirpSync(nodeModulesDir);

    return expect(
      () => new TarballStrategy(testPath).installTo({ toFolder }),
      'to be rejected with',
      'Tarball Failure: unsupported extension ".txt"'
    );
  });
});
