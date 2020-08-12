const debug = require('./debug').extend('LinkStrategy');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const tar = require('tar');

const TARBALL_EXTENSION = '.tgz';
const TARBALL_FILE_NAME_REGEX = /(.*)-(\d+\.\d+\.\d+)/;

class TarballStrategy {
  constructor(moduleTarballPath) {
    this.moduleTarballPath = moduleTarballPath;
  }

  async installTo(options) {
    const nodeModulesPath = path.join(options.toFolder, 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) {
      throw new Error('Tarball Failure: cannot link into missing node_modules');
    }

    const moduleTarballExt = path.extname(this.moduleTarballPath);
    if (moduleTarballExt !== TARBALL_EXTENSION) {
      throw new Error(
        `Tarball Failure: unsupported extension "${moduleTarballExt}"`
      );
    }
    const moduleTarballFileName = path.basename(
      this.moduleTarballPath,
      moduleTarballExt
    );
    const moduleMatch = moduleTarballFileName.match(TARBALL_FILE_NAME_REGEX);
    if (moduleMatch === null) {
      throw new Error(
        `Tarball Failure: unable to match package name and version`
      );
    }
    const [, packageName] = moduleMatch;

    const modulePackagePath = path.join(nodeModulesPath, packageName);

    await fsExtra.remove(modulePackagePath);
    await fsExtra.ensureDir(modulePackagePath);

    try {
      await tar.extract({
        cwd: modulePackagePath,
        file: this.moduleTarballPath,
        strip: 1
      });

      debug('tarball unpacking succeeded');
    } catch (err) {
      let error;
      if (err.message.indexOf('ENOENT') !== -1) {
        error = new Error('Tarball Failure: unable to unpack tarball');
      } else {
        error = err;
      }

      debug('tarball unpacking failed', err);

      throw error;
    }
  }
}

module.exports = TarballStrategy;
