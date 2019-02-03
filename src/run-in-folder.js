'use strict';

var la = require('./la');
var debug = require('./debug');
var check = require('check-more-types');
var chdir = require('chdir-promise');
var spawn = require('child_process').spawn;

function createError(output, defaultMessageFn) {
  const message =
    output.length > 0 ? `Test Failure\n${output.join('')}` : defaultMessageFn();

  return new Error(message);
}

function npmTest(cmd) {
  var app;
  var parts;

  if (check.unemptyString(cmd)) {
    cmd = cmd.trim();
    parts = cmd.split(' ');
    app = parts.shift();
  } else {
    throw new Error('test command missing');
  }

  la(check.unemptyString(app), 'application name should be a string', app);
  la(check.arrayOfStrings(parts), 'arguments should be an array', parts);

  return new Promise((resolve, reject) => {
    const npm = spawn(app, parts);
    let output = [];

    npm.stdout.on('data', data => {
      output.push(data);
    });

    let sawExit = false;

    npm.on('error', err => {
      if (sawExit) {
        return;
      }

      sawExit = true;

      const error = createError(output, () => err.toString());

      reject(error);
    });

    npm.on('exit', code => {
      if (sawExit) {
        return;
      }

      sawExit = true;

      if (code) {
        const error = createError(
          output,
          () => 'Could not execute ' + app + ' ' + parts.join(' ')
        );
        error.code = code;

        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function runInFolder(folder, command, options) {
  options = options || {};
  let sawError = null;

  return Promise.resolve()
    .then(() => {
      la(check.unemptyString(folder), 'expected folder');
      la(check.unemptyString(command), 'expected command');
    })
    .then(() => chdir.to(folder))
    .then(function() {
      debug(`running "${command}" from ${folder}`);
      return npmTest(command);
    })
    .then(function() {
      if (typeof options.success === 'string') {
        debug(`${options.success} in ${folder}`);
      }
    })
    .catch(error => {
      sawError = error;
      if (typeof options.failure === 'string') {
        debug(`${options.failure} in ${folder}`);
      }
    })
    .then(() => chdir.from())
    .then(() => {
      if (sawError !== null) {
        throw sawError;
      } else {
        return folder;
      }
    });
}

module.exports = runInFolder;
