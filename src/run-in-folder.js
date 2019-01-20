'use strict'

var la = require('lazy-ass')
var check = require('check-more-types')
var chdir = require('chdir-promise')
var spawn = require('child_process').spawn;

function npmTest (cmd) {
  var app
  var parts

  if (check.unemptyString(cmd)) {
    cmd = cmd.trim()
    parts = cmd.split(' ')
    app = parts.shift()
  } else {
    throw new Error('test command missing');
  }

  la(check.unemptyString(app), 'application name should be a string', app)
  la(check.arrayOfStrings(parts), 'arguments should be an array', parts)

  return new Promise((resolve, reject) => {
    const npm = spawn(app, parts);
    let testErrors = '';

    npm.on('error', function (err) {
      testErrors += err.toString()
    })

    npm.on('exit', function (code) {
      if (code) {
        var defaultMessage = 'Could not execute ' + app + ' ' + parts.join(' ')

        const error = new Error(testErrors || defaultMessage);
        error.code = code;

        reject(error)
      } else {
        resolve()
      }
    })
  });
}

function runInFolder (folder, command, options) {
  la(check.unemptyString(command), options.missing, command)
  la(check.unemptyString(folder), 'expected folder', folder)

  return chdir.to(folder)
    .then(function () {
      console.log(`running "${command}" from ${folder}`)
      return npmTest(command)
    })
    .then(function () {
      console.log(`${options.success} in ${folder}`)
      return folder
    })
    .catch(function (errors) {
      console.error(`${options.failure} in ${folder}`)
      console.error('code', errors.code)
      throw errors
    })
    .finally(chdir.from)
}

module.exports = runInFolder
