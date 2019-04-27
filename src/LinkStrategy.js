const debug = require('./debug').extend('LinkStrategy');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const packageCheck = require('./package-check');

class LinkStrategy {
  constructor(packagePath) {
    this.packagePath = packagePath;

    const checkedPackages = packageCheck(packagePath);

    this.packageName = checkedPackages.name;
    this.packageBinaries = checkedPackages.bin || {};
  }

  installTo(options) {
    const nodeModulesPath = path.join(options.toFolder, 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) {
      return Promise.reject(
        new Error('Link Failure: cannot link into missing node_modules')
      );
    }

    const modulePackagePath = path.join(nodeModulesPath, this.packageName);

    try {
      rimraf.sync(modulePackagePath);
    } catch (err) {
      return Promise.reject(err);
    }

    try {
      fs.symlinkSync(this.packagePath, modulePackagePath);

      debug('package linking succeeded');
    } catch (err) {
      let error;
      if (err.message.indexOf('ENOENT') !== -1) {
        error = new Error('Link Failure: unable to link package');
      } else {
        error = err;
      }

      debug('package linking failed', err);

      return Promise.reject(error);
    }

    const binaryNames = Object.keys(this.packageBinaries);
    const moduleBinaryPath = path.join(nodeModulesPath, '.bin');
    if (binaryNames.length > 0) {
      if (!fs.existsSync(moduleBinaryPath)) {
        fs.mkdirSync(moduleBinaryPath);
      }
    }

    binaryNames.forEach(binaryName => {
      const binaryRelativePath = this.packageBinaries[binaryName];
      const binaryAbsolutePath = path.join(
        this.packagePath,
        binaryRelativePath
      );
      const targetBinaryPath = path.join(moduleBinaryPath, binaryName);

      try {
        fs.symlinkSync(binaryAbsolutePath, targetBinaryPath);
      } catch (err) {
        debug(`package linking failed for binary ${binaryName}`, err);
      }
    });

    return Promise.resolve();
  }
}

module.exports = LinkStrategy;
