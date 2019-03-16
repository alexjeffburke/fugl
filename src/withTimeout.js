function createTimeoutError() {
  const error = new Error();
  error.name = 'TimeoutError';
  return error;
}

module.exports = function withTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) =>
      setTimeout(() => reject(createTimeoutError()), timeout)
    )
  ]);
};
