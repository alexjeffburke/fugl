'use strict';

var isRepoUrl = require('./is-repo-url');
var debug = require('./debug');
var exists = require('fs').existsSync;
var rimraf = require('rimraf');
var simpleGit = require('simple-git/promise')();

var runInFolder = require('./run-in-folder');
var mkdirp = require('mkdirp');

function createFolder(folder) {
  if (!exists(folder)) {
    debug('creating folder %s', folder);
    mkdirp.sync(folder);
  }
}

function removeFolder(folder) {
  if (exists(folder)) {
    debug('removing folder %s', folder);
    rimraf.sync(folder);
  }
}

function install(options) {
  let cmd = options.cmd;
  const moduleName = options.moduleName;
  const toFolder = options.toFolder;

  let res;
  if (isRepoUrl(moduleName)) {
    if (options.noClean && exists(toFolder)) {
      debug('updating repo %s', moduleName);

      res = simpleGit
        .cwd(toFolder)
        .then(() => simpleGit.pull())
        .then(() => debug('updated %s', moduleName));
    } else {
      removeFolder(toFolder);
      createFolder(toFolder);

      debug('cloning repo %s', moduleName);

      res = simpleGit.clone(moduleName, toFolder).then(() => {
        debug('cloned %s', moduleName);
      });
    }
  } else {
    cmd = `${cmd} ${moduleName}`;
    res = Promise.resolve();
  }

  return res.then(function() {
    return runInFolder(toFolder, cmd, {
      success: 'installing dependent module succeeded',
      failure: 'installing dependent module failed'
    });
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
