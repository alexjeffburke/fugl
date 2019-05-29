'use strict';

var debug = require('./debug').extend('installDependent');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var simpleGit = require('simple-git/promise')();

var runInFolder = require('./run-in-folder');
var withTimeout = require('./withTimeout');

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

function moduleCommand(cmd, cmdKey, { toFolder, dependent }) {
  if (!cmd) {
    debug('%s command skipped for %s', cmdKey, dependent.name);
    return Promise.resolve(toFolder);
  }

  debug('%s command for %s', cmdKey, dependent.name);

  return runInFolder(toFolder, cmd)
    .then(() => {
      debug('%s command succeeded for %s', cmdKey, dependent.name);
      return toFolder;
    })
    .catch(error => {
      debug('%s command failed for %s', cmdKey, dependent.name);
      throw error;
    });
}

function install(options, dependent) {
  const { moduleName, toFolder } = options;
  const timeout =
    typeof options.timeout === 'number'
      ? options.timeout
      : INSTALL_TIMEOUT_SECONDS;

  function moduleInstallWithTimeout(installOptions) {
    const cmd = dependent.install || DEFAULT_INSTALL_COMMAND;
    const installPromise = moduleCommand(cmd, 'install', installOptions);
    if (timeout > 0) {
      return withTimeout(installPromise, timeout);
    } else {
      return installPromise;
    }
  }

  function moduleAfterInstall(installOptions) {
    const cmd = dependent.afterinstall;
    return moduleCommand(cmd, 'afterinstall', installOptions);
  }

  return Promise.resolve()
    .then(() => moduleProvision(options))
    .then(() => moduleInstallWithTimeout({ toFolder, dependent }))
    .then(() => moduleAfterInstall({ toFolder, dependent }))
    .catch(error => {
      if (error.name === 'TimeoutError') {
        const message = `install timed out for ${moduleName}`;
        debug(message);
        error = new Error(message);
      }

      throw error;
    });
}

module.exports = install;
