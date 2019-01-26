var assert = require('assert');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

var dontBreak = require('../src/dont-break');

describe('when supplied module', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'builds'));
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      folder: path.join(__dirname),
      dep: ['https://github.com/bahmutov/dont-break-bar.git']
    }).then(() => {
      assert.ok(
        fs.existsSync(
          path.join(
            __dirname,
            'builds',
            'https-github-com-bahmutov-dont-break-bar-git'
          )
        )
      );
    });
  });
});

describe('when used within module', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'module', 'builds'));
  });

  it('should have created the module folder', () => {
    return dontBreak({
      folder: path.join(__dirname, 'module'),
      dep: ['https://github.com/bahmutov/dont-break-bar.git']
    }).then(() => {
      assert.ok(
        fs.existsSync(
          path.join(
            __dirname,
            'module',
            'builds',
            'https-github-com-bahmutov-dont-break-bar-git'
          )
        )
      );
    });
  });
});

describe('when used with a file', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'file', 'builds'));
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      folder: path.join(__dirname, 'file')
    }).then(() => {
      assert.ok(
        fs.existsSync(
          path.join(
            __dirname,
            'file',
            'builds',
            'https-github-com-bahmutov-dont-break-bar'
          )
        )
      );
    });
  });
});
