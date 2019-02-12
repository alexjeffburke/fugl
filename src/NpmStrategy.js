const runInFolder = require('./run-in-folder');

function parsePackage(packageString) {
  if (typeof packageString !== 'string' || packageString.trim().length === 0) {
    throw new Error(`Invalid package @{package}`);
  }

  let packageParts;
  let name;
  if (packageString[0] === '@') {
    packageParts = packageString.slice(1).split('@');
    name = '@';
  } else {
    packageParts = packageString.split('@');
    name = '';
  }

  name += packageParts[0];

  let version = null;
  if (packageParts.length === 2) {
    version = packageParts[1];
  } else {
    version = null;
  }

  return { name, version };
}

class NpmStrategy {
  constructor(packageString) {
    const packageInfo = parsePackage(packageString);
    this.packageName = packageInfo.name;
    this.packageVersion = packageInfo.version || 'latest';
  }

  installTo(options, overrides) {
    const performInstall = options._runInFolder || runInFolder;
    const installDir = options.toFolder;

    overrides = overrides || {};
    const installCommand =
      overrides.postinstall ||
      `npm install ${this.packageName}@${this.packageVersion}`;

    return performInstall(installDir, installCommand, {
      success: 'postinstall succeeded',
      failure: 'postinstall did not work'
    });
  }
}

module.exports = NpmStrategy;