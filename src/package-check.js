const path = require('path');

module.exports = function packageCheck(packagePath) {
  let pkg;
  try {
    pkg = require(path.join(packagePath, 'package.json'));
  } catch (e) {
    throw new Error(`The folder ${packagePath} contain no valid package.`);
  }

  if (!pkg.name) {
    throw new Error(`The package in ${packagePath} has no name.`);
  }

  return pkg;
};
