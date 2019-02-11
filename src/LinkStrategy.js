const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const packageCheck = require('./package-check');

class LinkStrategy {
  constructor(packagePath) {
    this.packagePath = packagePath;
    this.packageName = packageCheck(packagePath).name;
  }

  installTo(options) {
    const modulePackagePath = path.join(
      options.toFolder,
      'node_modules',
      this.packageName
    );

    try {
      rimraf.sync(modulePackagePath);
    } catch (err) {
      return Promise.reject(err);
    }

    try {
      fs.symlinkSync(this.packagePath, modulePackagePath);

      return Promise.resolve();
    } catch (err) {
      let error;
      if (err.message.indexOf('ENOENT') !== -1) {
        error = new Error('Link Failure: unable to link package');
      } else {
        error = err;
      }
      return Promise.reject(error);
    }
  }
}

module.exports = LinkStrategy;
