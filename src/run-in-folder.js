'use strict';

var la = require('./la');
var debug = require('./debug').extend('runInFolder');
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

function npmTest(cwd, args) {
  let app = args.shift();

  if (isWindows && app === 'npm') {
    app = 'npm.cmd';
  }

  return new Promise((resolve, reject) => {
    const npm = spawn(app, args, { cwd });
    const output = [];

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

async function runInFolder(folder, args, options) {
  options = options || {};

  try {
    assertUnemptyString(folder, 'expected folder');

    let command;
    if (Array.isArray(args)) {
      command = args.join(' ');
    } else {
      command = args;
      assertUnemptyString(command, 'expected command');
      command = command.trim();
      assertUnemptyString(command, 'expected command');
      args = command.split(' ');
    }

    debug(`running "${command}" from ${folder}`);
    await npmTest(folder, args);

    debug(`running succeeded from ${folder}`);
    return folder;
  } catch (error) {
    debug(`running failed from ${folder}`);
    throw error;
  }
}

module.exports = runInFolder;
