const expect = require('unexpected');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');

const LinkStrategy = require('../src/LinkStrategy');

describe('LinkStrategy', () => {
  const moduleDir = path.join(__dirname, 'module');
  const toFolder = path.join(__dirname, 'module', 'builds');

  beforeEach(() => {
    rimraf.sync(toFolder);
  });

  it('should succeed linking into present node_modules', () => {
    mkdirp.sync(path.join(toFolder, 'node_modules'));

    return expect(
      () => new LinkStrategy(moduleDir).installTo({ toFolder }),
      'to be fulfilled'
    ).then(() => {
      const stat = fs.lstatSync(
        path.join(toFolder, 'node_modules', 'dont-break-foo')
      );
      expect(stat, 'to be an object');
      expect(stat.isSymbolicLink(), 'to be true');
    });
  });

  it('should error linking into missing node_modules', () => {
    return expect(
      () => new LinkStrategy(moduleDir).installTo({ toFolder }),
      'to be rejected with',
      'Link Failure: unable to link package'
    );
  });
});
