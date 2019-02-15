const expect = require('unexpected');

const isRepoUrl = require('../src/is-repo-url');

describe('isRepoUrl', () => {
  it('should not allow "foo"', () => {
    expect(isRepoUrl('foo'), 'to be false');
  });

  it('should not allow "foo/bar"', () => {
    expect(isRepoUrl('foo/bar'), 'to be false');
  });

  it('should not allow "foo/bar.git"', () => {
    expect(isRepoUrl('foo/bar.git'), 'to be false');
  });

  it('should allow "https://foo/bar.git"', () => {
    expect(isRepoUrl('https://foo/bar.git'), 'to be true');
  });

  it('should allow "https://foo/bar"', () => {
    expect(isRepoUrl('https://foo/bar'), 'to be true');
  });
});
