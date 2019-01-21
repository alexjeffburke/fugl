const assert = require('assert');

module.exports = function(bool, ...args) {
  assert.ok(bool, args.join(' '));
};
