import { timeoutPromise } from './promise';

/**
 * Checks if a network request came back fine, and throws an error if not
 *
 * @param  {object} response   A response from a network request
 *
 * @return {object|undefined} Returns either the response, or throws an error
 */
function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  const error = new Error(response.statusText);
  error.response = response;
  error.status = response.status;

  throw error;
}

/**
 * Requests a URL, returning a promise
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @param  {number} [timeout] Amount of seconds before we trigger a timeout
 * @return {object}           The response data
 */
export default function request(url, options = {}, timeout = 8000) {
  return timeoutPromise(timeout, fetch(url, options)
    .then(checkStatus));
}
