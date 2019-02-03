'use strict';

var debug = require('./debug');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var rimraf = require('rimraf');
var simpleGit = require('simple-git/promise')();

var isRepoUrl = require('./is-repo-url');
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

function moduleProvision({ moduleName, toFolder, ...options }) {
  if (isRepoUrl(moduleName)) {
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
  } else {
    return Promise.resolve();
  }
}

function moduleInstall({ moduleName, toFolder }, dependent) {
  let cmd = dependent.install || DEFAULT_INSTALL_COMMAND;
  if (!isRepoUrl(moduleName)) {
    cmd = `${cmd} ${moduleName}`;
  }

  function formFullFolderName() {
    if (isRepoUrl(moduleName)) {
      // simple repo installation
      return toFolder;
    } else {
      let scoped = moduleName.startsWith('@');
      let idx = scoped ? 1 : 0;
      let moduleDir = moduleName.split('@')[idx];
      moduleDir = scoped ? `@${moduleDir}` : moduleDir;
      return path.join(toFolder, 'node_modules', moduleDir);
    }
  }

  return runInFolder(toFolder, cmd, {
    success: 'installing module succeeded',
    failure: 'installing module failed'
  })
    .then(formFullFolderName)
    .then(function checkInstalledFolder(folder) {
      if (!fs.existsSync(folder)) {
        throw new Error(`unable to verify installation at ${folder}`);
      }
      return folder;
    });
}

function install({ moduleName, toFolder, ...options }, dependent) {
  var timeoutSeconds = options.timeout || INSTALL_TIMEOUT_SECONDS;

  function _install() {
    return Promise.resolve()
      .then(() => moduleProvision({ moduleName, toFolder, ...options }))
      .then(() => moduleInstall({ moduleName, toFolder }, dependent));
  }

  return Promise.race([
    _install().then(() => null),
    new Promise(resolve =>
      setTimeout(() => resolve({ timeout: true }), timeoutSeconds)
    )
  ]).then(result => {
    if (result && result.timeout) {
      debug('install timed out for ' + moduleName);
      throw new Error('timeout');
    }
    return result;
  });
}

module.exports = install;

if (!module.parent) {
  // quick and dirty test of module install
  var join = require('path').join;
  var osTmpdir = require('os-tmpdir');
  var folder = join(osTmpdir(), 'test-install');
  console.log('tmp folder for testing');
  console.log(folder);

  install({
    // name: 'boggle-connect',
    name: 'https://github.com/bahmutov/dont-break-bar',
    prefix: folder
  }).then(
    function() {
      console.log('all done');
    },
    function(err) {
      console.error('Could not install');
      console.error(err);
    }
  );
}
