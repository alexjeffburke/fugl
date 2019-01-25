'use strict';

var isRepoUrl = require('./is-repo-url');
var debug = require('debug')('dont-break');
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

  let res;
  if (isRepoUrl(options.name)) {
    removeFolder(options.prefix);
    createFolder(options.prefix);

    debug('installing repo %s', options.name);

    res = simpleGit.clone(options.name, options.prefix).then(() => {
      debug('cloned %s', options.name);
    });
  } else {
    cmd = `${cmd} ${options.name}`;
    res = Promise.resolve();
  }

  return res.then(function() {
    return runInFolder(options.prefix, cmd, {
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
