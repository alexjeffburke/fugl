// Allow using DEBUG=true instead of debug-module syntax
if (process.env.DEBUG === 'true') {
  process.env.DEBUG = 'fugl*';
}

module.exports = require('debug')('fugl');
