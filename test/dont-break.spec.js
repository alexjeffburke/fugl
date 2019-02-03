var assert = require('assert');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var simpleGit = require('simple-git/promise')();

var dontBreak = require('../src/dont-break');

describe('when supplied module', () => {
  const baseDir = path.join(__dirname, 'scratch', 'builds');
  const dir = path.join(
    baseDir,
    'https-github-com-bahmutov-dont-break-bar-git'
  );

  beforeEach(() => {
    rimraf.sync(baseDir);
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      reporter: 'none',
      folder: path.join(__dirname, 'scratch'),
      dep: ['https://github.com/bahmutov/dont-break-bar.git']
    }).then(() => {
      assert.ok(fs.existsSync(dir));
    });
  });
});

describe('when supplied module and noClean', () => {
  const baseDir = path.join(__dirname, 'noclean', 'builds');
  const dir = path.join(
    baseDir,
    'https-github-com-bahmutov-dont-break-bar-git'
  );
  const file = path.join(dir, 'test-file-in-checkout');

  beforeEach(() => {
    rimraf.sync(baseDir);

    return simpleGit
      .clone('https://github.com/bahmutov/dont-break-bar.git', dir)
      .then(() => {
        fs.writeFileSync(file, '');
      });
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      reporter: 'none',
      noClean: true,
      folder: path.join(__dirname, 'noclean'),
      dep: ['https://github.com/bahmutov/dont-break-bar.git']
    }).then(() => {
      assert.ok(fs.existsSync(dir));
      // the file should still be there if noClean applied correctly
      assert.ok(fs.existsSync(file));
    });
  });
});

describe('when used within module', () => {
  const baseDir = path.join(path.join(__dirname, 'module', 'builds'));
  const dir = path.join(
    baseDir,
    'https-github-com-bahmutov-dont-break-bar-git'
  );

  beforeEach(() => {
    rimraf.sync(baseDir);
  });

  it('should have created the module folder', () => {
    return dontBreak({
      reporter: 'none',
      folder: path.join(__dirname, 'module'),
      dep: ['https://github.com/bahmutov/dont-break-bar.git']
    }).then(() => {
      assert.ok(fs.existsSync(dir));
    });
  });
});

describe('when used with a file (array)', () => {
  const baseDir = path.join(path.join(__dirname, 'file-array', 'builds'));
  const dir = path.join(baseDir, 'https-github-com-bahmutov-dont-break-bar');

  beforeEach(() => {
    rimraf.sync(baseDir);
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      reporter: 'none',
      folder: path.join(__dirname, 'file-array')
    }).then(() => {
      assert.ok(fs.existsSync(dir));
    });
  });
});

describe('when used with a file (object)', () => {
  const baseDir = path.join(path.join(__dirname, 'file-object', 'builds'));
  const dir = path.join(baseDir, 'https-github-com-bahmutov-dont-break-bar');

  beforeEach(() => {
    rimraf.sync(baseDir);
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      reporter: 'none',
      folder: path.join(__dirname, 'file-object')
    }).then(() => {
      assert.ok(fs.existsSync(dir));
    });
  });
});

describe('when reporting with html', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'html', 'breakage'));
    rimraf.sync(path.join(__dirname, 'html', 'builds'));
  });

  it('should have created the module folder', () => {
    return dontBreak({
      package: 'dont-break-foo',
      reporter: 'html',
      folder: path.join(__dirname, 'html'),
      dep: ['https://github.com/bahmutov/dont-break-bar.git']
    }).then(() => {
      assert.ok(
        fs.existsSync(path.join(__dirname, 'html', 'breakage', 'index.html'))
      );
    });
  });
});
