/*
Legacy build for older browsers, includes polyfills
 */


// Import polyfill for promise
import 'core-js/es/promise';
// Import polyfill for object functions
import 'core-js/es/object/assign';
// Import polyfill for string functions
import 'core-js/es/string/starts-with';
// Import polyfills for the array functions the SDK uses
import 'core-js/es/array/from';
import 'core-js/es/array/find';
// Import polyfill for fetch
import 'whatwg-fetch';

import Its123 from './Api/Its123';

// Bind Its123 to the global window
window.Its123 = Its123;
