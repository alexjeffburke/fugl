'use strict';

var debug = require('./debug').extend('installDependent');
var fs = require('fs');
var fsExtra = require('fs-extra');

var runInFolder = require('./run-in-folder');
var withTimeout = require('./withTimeout');

var DEFAULT_INSTALL_COMMAND = 'npm install';
var INSTALL_TIMEOUT_SECONDS = 2 * 60 * 1000; // 2 minutes

async function createFolder(folder) {
  if (!fs.existsSync(folder)) {
    debug('creating folder %s', folder);
    await fsExtra.mkdirp(folder);
  }
}

async function removeFolder(folder) {
  if (fs.existsSync(folder)) {
    debug('removing folder %s', folder);
    await fsExtra.remove(folder);
  }
}

async function provisionModule(options) {
  const { moduleName, toFolder } = options;

  if (options.noClean && fs.existsSync(toFolder)) {
    debug('updating repo %s', moduleName);

    await installDependent.runInFolder(toFolder, ['git', 'pull']);

    debug('updated %s', moduleName);
  } else {
    await removeFolder(toFolder);
    await createFolder(toFolder);

    debug('cloning repo %s', moduleName);

    await installDependent.runInFolder(toFolder, [
      'git',
      'clone',
      moduleName,
      '.'
    ]);

    debug('cloned %s', moduleName);
  }
}

async function moduleCommand(
  cmd,
  cmdKey,
  { toFolder, dependent, timeout = 0 }
) {
  if (!cmd) {
    debug('%s command skipped for %s', cmdKey, dependent.name);
    return;
  }

  debug('%s command for %s', cmdKey, dependent.name);

  try {
    const installPromise = installDependent.runInFolder(toFolder, cmd);

    if (timeout > 0) {
      await withTimeout(installPromise, timeout);
    } else {
      await installPromise;
    }

    debug('%s command succeeded for %s', cmdKey, dependent.name);
  } catch (error) {
    debug('%s command failed for %s', cmdKey, dependent.name);
    throw error;
  }
}

async function installDependent(options, dependent) {
  const { moduleName, toFolder } = options;
  const timeout =
    typeof options.timeout === 'number'
      ? options.timeout
      : INSTALL_TIMEOUT_SECONDS;

  try {
    await installDependent.provisionModule(options);

    const installOptions = { toFolder, dependent };
    const installCmd = dependent.install || DEFAULT_INSTALL_COMMAND;
    await moduleCommand(installCmd, 'install', { ...installOptions, timeout });
    await moduleCommand(dependent.afterinstall, 'afterinstall', installOptions);
  } catch (error) {
    if (error.name === 'TimeoutError') {
      const message = `install timed out for ${moduleName}`;
      debug(message);
      throw new Error(message);
    }

    throw error;
  }
}

installDependent.provisionModule = provisionModule;
installDependent.runInFolder = runInFolder;

module.exports = installDependent;
