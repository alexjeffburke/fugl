var debug = require('debug')('dont-break');

var argv = require('yargs')
  .option('t', {
    alias: 'top-downloads',
    type: 'number',
    describe: 'Fetch N most downloaded dependent modules, save and check'
  })
  .option('s', {
    alias: 'top-starred',
    type: 'number',
    describe: 'Fetch N most starred dependent modules, save and check'
  })
  .option('d', {
    alias: 'dep',
    type: 'array',
    describe: 'Check if current code breaks given dependent project(s)'
  })
  .option('timeout', {
    alias: 'timeout',
    type: 'number',
    describe: 'Wait for N seconds when installing a package'
  })
  .option('reporter', {
    alias: 'reporter'
  }).argv;

debug('command line options');
debug(argv);

module.exports = argv;
