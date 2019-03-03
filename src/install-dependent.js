'use strict';

var debug = require('./debug');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var simpleGit = require('simple-git/promise')();

var runInFolder = require('./run-in-folder');

var DEFAULT_INSTALL_COMMAND = 'npm install';
var INSTALL_TIMEOUT_SECONDS = 2 * 60 * 1000; // 2 minutes

function createFolder(folder) {
  if (!fs.existsSync(folder)) {
    debug('creating folder %s', folder);
    mkdirp.sync(folder);
  }
}

function removeFolder(folder) {
  if (fs.existsSync(folder)) {
    debug('removing folder %s', folder);
    rimraf.sync(folder);
  }
}

function moduleProvision(options) {
  const { moduleName, toFolder } = options;

  if (options.noClean && fs.existsSync(toFolder)) {
    debug('updating repo %s', moduleName);

    return simpleGit
      .cwd(toFolder)
      .then(() => simpleGit.pull())
      .then(() => debug('updated %s', moduleName));
  } else {
    removeFolder(toFolder);
    createFolder(toFolder);

    debug('cloning repo %s', moduleName);

    return simpleGit.clone(moduleName, toFolder).then(() => {
      debug('cloned %s', moduleName);
    });
  }
}

function moduleInstall({ toFolder }, dependent) {
  const cmd = dependent.install || DEFAULT_INSTALL_COMMAND;

  return runInFolder(toFolder, cmd, {
    success: 'installing module succeeded',
    failure: 'installing module failed'
  }).then(() => toFolder);
}

function install(options, dependent) {
  const { moduleName, toFolder } = options;
  var timeoutSeconds = options.timeout || INSTALL_TIMEOUT_SECONDS;

  function _install() {
    return Promise.resolve()
      .then(() => moduleProvision(options))
      .then(() => moduleInstall({ moduleName, toFolder }, dependent));
  }

  return Promise.race([
    _install().then(() => null),
    new Promise(resolve =>
      setTimeout(() => resolve({ timeout: true }), timeoutSeconds)
    )
  ]).then(result => {
    if (result && result.timeout) {
      const message = `install timed out for ${moduleName}`;
      debug(message);
      throw new Error(message);
    }
    return result;
  });
}

module.exports = install;
