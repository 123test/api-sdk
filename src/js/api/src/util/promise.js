/**
 * Promise with timeout function
 * @param  {Number} ms      Miliseconds to wait before promise is rejected
 * @param  {Promise} promise The promise to run
 * @return {Promise}         Promise with timeout
 */
export function timeoutPromise(ms, promise) {
  return new Promise((resolve, reject) => {
    // Create timer that rejects promise after ms miliseconds
    const timeoutId = setTimeout(() => {
      const error = new Error('timeout');
      error.status = 408;
      reject(error);
    }, ms);

    // Clear timeout if promise resolves/rejects on its own
    promise.then(
      (res) => {
        clearTimeout(timeoutId);
        resolve(res);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      },
    );
  });
}

/**
 * Decorates a promis-creating function with a retry functionality (by recursion)
 * @param  {Number}   maxRetries  Max number of retries
 * @param  {Number}   timeout     Miliseconds to wait
 * @param  {Function} fn          Function that creates and returns a promise
 * @param  {Number}   timeoutFactor timeout is multiplied by this factor every retry
 * @param  {Number}   [current=0] Current iteration in the retry loop
 * @return {Promise}
 */
export function tryAtMost(maxRetries, timeout, fn, timeoutFactor = 4, current = 0) {
  return new Promise((resolve, reject) => fn()
    .then(resolve)
    .catch((error) => {
      if (current < maxRetries) {
        setTimeout(() =>
          resolve(tryAtMost(maxRetries, timeout * timeoutFactor, fn, timeoutFactor, current + 1)),
          timeout,
        );
      } else {
        reject(error);
      }
    }),
  );
}

export function retryUntilResolved(fn) {
  return new Promise(resolve => fn()
    .then(resolve)
    .catch(() => resolve(retryUntilResolved(fn))),
  );
}
