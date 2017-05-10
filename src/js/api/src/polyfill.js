/*
Legacy build for older browsers, includes polyfills
 */


// Import polyfill for promise
import 'core-js/es6/promise';
// Import polyfill for object functions
import 'core-js/es6/object';
// Import polyfill for string functions
import 'core-js/fn/string/starts-with';
// Import polyfill for fetch
import 'whatwg-fetch';

import Its123 from './Api/Its123';

// Bind Its123 to the global window
window.Its123 = Its123;
