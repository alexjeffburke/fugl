'use strict';

var la = require('./la');
var debug = require('./debug');
var spawn = require('cross-spawn');

var isWindows = process.platform === 'win32';

function assertUnemptyString(subject, assertionMessage) {
  const isValid = typeof subject === 'string' && subject.length > 0;
  la(isValid, assertionMessage);
}

function createError(prefix, output, defaultMessageFn) {
  let message = `${prefix} Failure\n`;
  message += output.length > 0 ? output.join('') : defaultMessageFn();
  return new Error(message);
}

function npmTest(cwd, cmd) {
  const args = cmd.split(' ');
  let app = args.shift();

  if (isWindows && app === 'npm') {
    app = 'npm.cmd';
  }

  return new Promise((resolve, reject) => {
    const npm = spawn(app, args, { cwd });
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

      const error = createError('Command', output, () => err.toString());

      reject(error);
    });

    npm.on('exit', code => {
      if (sawExit) {
        return;
      }

      sawExit = true;

      if (code) {
        const error = createError(
          'Test',
          output,
          () => 'Could not execute ' + app + ' ' + args.join(' ')
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
      assertUnemptyString(folder, 'expected folder');
      assertUnemptyString(command, 'expected command');
      command = command.trim();
      assertUnemptyString(command, 'expected command');
    })
    .then(function() {
      debug(`running "${command}" from ${folder}`);
      return npmTest(folder, command);
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
    .then(() => {
      if (sawError !== null) {
        throw sawError;
      } else {
        return folder;
      }
    });
}

module.exports = runInFolder;
