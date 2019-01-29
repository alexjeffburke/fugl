var Fugl = require('./Fugl');

module.exports = function dontBreak(options) {
  if (typeof options === 'string' && options.length > 0) {
    options = {
      folder: options
    };
  }

  if (options.dep) {
    options.projects = options.dep;
    delete options.dep;
  }

  return new Fugl(options).run();
};
