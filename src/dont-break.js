var Fugl = require('./Fugl');

module.exports = function dontBreak(options) {
  if (typeof options === 'string' && options.length > 0) {
    options = {
      folder: options
    };
  }

  return new Fugl(options).run();
};
