const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const rimraf = require('rimraf');
const sinon = require('sinon');

const Fugl = require('../src/Fugl');

describe('Fugl', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, 'scratch', 'builds'));
  });

  it('should return stats on a pass', () => {
    const fugl = new Fugl({ dep: ['FOO'], reporter: 'none' });
    const testDependentStub = sinon
      .stub(fugl, 'testDependent')
      .callsFake(emitter => {
        emitter.emit('pass', { title: 'FOO' });

        return Promise.resolve();
      });

    return expect(() => fugl.run(), 'to be fulfilled with', {
      passes: 1,
      failures: 0
    }).then(() => {
      expect(testDependentStub, 'was called');
    });
  });

  it('should return stats on a fail', () => {
    const fugl = new Fugl({ dep: ['FOO'], reporter: 'none' });
    const testDependentStub = sinon
      .stub(fugl, 'testDependent')
      .callsFake(emitter => {
        emitter.emit('fail', { title: 'FOO' }, new Error('failure'));

        return Promise.resolve();
      });

    return expect(() => fugl.run(), 'to be fulfilled with', {
      passes: 0,
      failures: 1
    }).then(() => {
      expect(testDependentStub, 'was called');
    });
  });
});
