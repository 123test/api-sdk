/*
 * 123Test Api v2
 *
 * @author Wouter Bulten <github.com/wouterbulten>
 * @author Theo den Hollander <github.com/theodenhollander>
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 123test
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import 'regenerator-runtime/runtime';

import request from '../util/request';

import { tryAtMost } from '../util/promise';

import ClientStorage from '../util/storage';

/**
 * Default configuration for api, can be overriden by user
 * @type {Object}
 */
const defaultApiConfig = {
  // Domain config
  domain: 'https://api.123test.com',
  version: 'v2',

  // Environment config
  logLevel: 'all', // One of: all, info, error, none

  // DOM config
  elements: {
    // Selector used to bind events to instrument forms, we advise
    // not to alter this selector.
    instrumentFormSelector: 'form.its123-instrument',
    // ID for the loading div
    loadingElementId: 'its123api-loading',
    // ID for the instrument/product div
    productElementId: 'its123api-product',
    // ID for the report div
    reportElementId: 'its123api-report',
    // ID for the prefetch resource
    prefetchResourceElementId: 'its123api-prefetch-resource-data',

    // Internal placeholders for the DOM elements, do not set these to any values
    loadingElement: null,
    productElement: null,
    reportElement: null,
  },

  // Number of retries some fetch request may make
  maxHttpRetries: 2,
  // Initial delay before a retry
  retryDelay: 8000,
  // Number of times a user can try to resubmit a form
  maxSubmitRetries: 10,
  // Number of times the API tries to start a prefetched product run
  maxPrefetchRunAttempts: 10,

  // Whether to use localStorage for caching
  storageEnabled: true,
  storagePrefix: 'its123Api',

  // Public api key used for every request
  apiKey: 'not-set',

  // loaded product ID
  productId: 'not-set',

  // Epoch time user
  epochStart: null,
  epochCompleted: null,
};

/**
 * Main API class
 */
class Its123 {

  /**
   * Create new Api object
   * @param  {Object} [apiConfig={}] Api configuration
   * @return {void}
   */
  constructor(apiConfig = {}) {
    // Set api config to default and override with parameters
    this.api = {
      ...defaultApiConfig,
      ...apiConfig,
    };
    // Construct correct api end point
    this.api.endpoint = `${this.api.domain}/${this.api.version}`;

    // Check for valid api key
    if (this.api.apiKey === 'not-set') {
      throw new Error(
        'Api key must be set when initalising Its123 object. Please check your api config.',
      );
    }

    // Query the DOM and set options
    this.api.elements.loadingElement = document.getElementById(this.api.elements.loadingElementId);
    this.api.elements.productElement = document.getElementById(this.api.elements.productElementId);
    this.api.elements.reportElement = document.getElementById(this.api.elements.reportElementId);
    this.api.elements.prefetchResourceElement = document.getElementById(
      this.api.elements.prefetchResourceElementId);

    if (!this.api.elements.loadingElement
      || !this.api.elements.productElement || !this.api.elements.reportElement) {
      throw new Error(
        'Element for loading, product or report not found. Please check your HTML and Api config.',
      );
    }

    // Placeholder for eventlisteners
    this.eventListeners = {};

    // Create new storage object for localStorage functionality
    this.store = new ClientStorage(this.api.storageEnabled, this.api.storagePrefix);
  }

  /**
   * Wrapper around loadAndRunProduct with error handling
   *
   * @param  {String} productId product to load
   * @param  {Object} [config={}] Product configuration, see loadAndRunProduct
   * @return {Promise}
   * @see loadAndRunProduct()
   */
  async loadProduct(productId, { renderReport = true, user = '' } = {}) {
    try {
      this.api.epochStart = Its123.currentEpochTime();
      this.api.productId = productId;
      return await this.loadAndRunProduct(productId, { renderReport, user });
    } catch (error) {
      // Something could be wrong with our local store,
      // clear it to prevent any future errors
      this.store.clearProduct(productId);
      this.handleException('loadProduct', error, { productId, renderReport, user });

      throw error;
    }
  }

  /**
   * Start a product run given an prefetched insrument
   * @param  {String} productId product to load
   * @param  {Object} [config={}] Product configuration, see loadAndRunProduct
   * @return {Promise}
   * @see loadAndRunProduct()
   */
  async prefetchProduct(productId, { renderReport = true, user = '' } = {}) {
    // Load prefetched resource data
    this.api.epochStart = Its123.currentEpochTime();
    if (this.api.elements.prefetchResourceElement) {
      const resources = JSON.parse(atob(this.api.elements.prefetchResourceElement.value));
      await Its123.loadResources(resources);
      await this.runResourceFunctions(resources);
    }

    // First check for existing run in storage
    const product = this.store.loadProduct(productId, user);

    if (product) {
      // Revert to non-prefetch call if the user has data in local storage
      return this.loadProduct(productId, { renderReport, user });
    }

    // Enable localstorage support for anonymous instruments
    // Use the product key as the id to prevent loading data from other products
    this.loadInstrumentStateFromStorage(`st-${productId}`);
    this.bindInstrumentStorageListeners(`st-${productId}`);

    let lastError = null;

    for (let i = 0; i < this.api.maxPrefetchRunAttempts; i += 1) {
      // Wait for prefetched instrument to submit
      const form = await this.waitForInstrumentToSubmit();

      // Clear local storage from temporary instrument data
      this.store.removeByPrefix(`st-${productId}`);

      try {
        return await this.loadAndRunProduct(productId, { renderReport, user }, form);
      } catch (error) {
        lastError = error;
      }
    }

    // Max attempts exceeded, rethrow the last error.
    // Something could be wrong with our local store,
    // clear it to prevent any future errors
    this.store.clearProduct(productId);
    throw lastError;
  }

  /**
   * Restarts a product by clearing any local data
   *
   * @param  {String} productId product to load
   * @param  {Object} [config={}] Product configuration, see loadAndRunProduct
   * @return {Promise}
   * @see loadAndRunProduct()
   */
  async restartProduct(productId, { renderReport = true, user = '' } = {}) {
    this.store.clearProduct(productId);
    return this.loadProduct(productId, { renderReport, user });
  }

  /**
   * Load and run a product
   *
   * Runs all the required sub steps from instrument to report. All promises are chained
   * and the final promise returns the product data when resolved.
   *
   * Will automatically render the first report that is available. Set `renderReport` to false
   * to counter this behaviour.
   *
   * Data structure of the product object:
   *
   * product = {
   *  slots: {
   *    instruments: [],
   *    respondent: {},
   *  },
   *  reports: [],
   *  access_code: null,
   * };
   *
   * @param  {String} productId product to load
   * @param  {Boolean} [renderReport=true] Set to true to automatically call the
   *                                       report render functions
   * @param  {String}  [user=''] Optional user UUID
   * @return {Promise}
   */
  async loadAndRunProduct(productId, { renderReport = true, user = '' } = {}, prefetchedForm = null) {
    let product = null;

    // Show loading div (only when not in prefetch mode)
    if (!prefetchedForm) {
      this.api.elements.productElement.style.display = 'none';
      this.api.elements.loadingElement.style.display = 'block';
    }

    // Try to load product information from local storage, if it fails
    // fall back to a API request
    product = this.store.loadProduct(productId, user);

    if (!product) {
      product =
          await tryAtMost(this.api.maxHttpRetries, this.api.retryDelay, () =>
              this.requestProduct(productId, user),
          );

      // Store the requested product in the local store for future requests
      this.store.saveProduct(productId, product, user);
    }
    this.triggerEvent('product-loaded', product);
    let instruments = product.slots.instruments;
    this.triggerEvent('instruments-loaded', instruments);

    // Filter any instruments that already have been completed
    // Prevents unnecessary requests to the API
    instruments = instruments.filter((i) => {
      const status = this.store.loadInstrumentStatus(i.access_code);

      switch (status) {
        case 'ended-items':
        case 'ended-skipped':
        case 'ended-time':
          this.triggerEvent('instrument-already-completed',
            { accessCode: i.access_code, status });
          return false;
        case 'in-progress':
          this.triggerEvent('instrument-continue',
            { accessCode: i.access_code, status });
          return true;
        case 'started':
        default:
          return true;
      }
    });

    for (let i = 0; i < instruments.length; i += 1) {
      const accessCode = instruments[i].access_code;

      let result;
      if (i === 0 && prefetchedForm) {
        // Skip requesting the instrument when it is the first and a prefetched
        // form is on the page.
        this.triggerEvent('instrument-prefetched', {});
        result = { status: 'prefetched', form: prefetchedForm };
      } else {
        result = await this.requestInstrument(accessCode);
        this.triggerEvent('instrument-started', { accessCode, status: result.status });
      }

      await this.processApiInstrumentResponse(accessCode, result);
    }


    if (renderReport) {
      // All instruments have been completed, render report
      const { body, resources } = await this.requestReport(product.reports[0].access_code);
      await Its123.loadResources(resources);
      this.renderReport(body);
      this.runResourceFunctions(resources);
      this.triggerEvent('report-ready');
    }

    // Remove this session from the local storage
    this.store.clearProduct(productId);
    // Trigger event and pass product info
    this.triggerEvent('product-completed', product);

    return product;
  }

  /**
   * Load an render a report by its access code
   * @param  {String} accessCode Access code for report
   * @param  {String} metaData  Base64 encoded meta data
   * @param  {String} metaHmac  HMAC for meta data
   * @return {Promise}
   */
  async loadReport(accessCode, { metaData, metaHmac } = {}) {
    try {
      const { body, resources } =
        await tryAtMost(this.api.maxHttpRetries, this.api.retryDelay, () =>
          this.requestReport(accessCode, { metaData, metaHmac }),
      );
      await Its123.loadResources(resources);
      this.renderReport(body);
      this.runResourceFunctions(resources);
      this.triggerEvent('report-ready');
    } catch (error) {
      this.enableSubmitButton();
      this.handleException('loadReport', error, { accessCode, metaData, metaHmac });

      throw error;
    }
  }

  /**
   * Process a single API response from an instrument call
   *
   * When the instrument is still running the function will return a new Promise
   * that waits for a form submit.
   *
   * @param  {String} accessCode Access code for this instrument
   * @param  {String} status     Current instrument status
   * @param  {Array} resources  Resources to load
   * @param  {String} body       Html to put in the DOM
   * @param  {Object} form      (Optional) submitted form+event object for prefetch requests
   * @return {Promise}
   */
  async processApiInstrumentResponse(accessCode, { status, resources, body, form = null }) {
    switch (status) {
      case 'prefetched':
        if (!form) {
          throw new Error('Cannot handle prefetch state without existing instrument form');
        }
        // Run function again until instrument has ended with data from form
        return await this.processApiInstrumentResponse(accessCode,
          await this.processFormSubmit(accessCode, form),
        );
      case 'started':
      case 'in-progress':
        this.api.epochStart = Its123.currentEpochTime();
        this.store.saveInstrumentStatus(accessCode, status);

        // Wait for resources to load
        await Its123.loadResources(resources);

        this.renderInstrument(body);

        // Try to load item data from local storage
        this.loadInstrumentStateFromStorage(accessCode);
        this.bindInstrumentStorageListeners(accessCode);

        this.runResourceFunctions(resources);
        this.triggerEvent('instrument-submitted');
        // Run function again until instrument has ended
        return await this.processApiInstrumentResponse(accessCode,
          await this.processFormSubmit(accessCode),
        );
      case 'ended-items':
      case 'ended-skipped':
      case 'ended-time':
        this.store.saveInstrumentStatus(accessCode, status);
        this.triggerEvent('instrument-completed', { accessCode, status });
        break;
      default:
        // This is an unrecoverable error due to an unknown API response.
        // The submit buttion is reenabled, the user can then try to submit at a later stage.
        this.enableSubmitButton();

        // Throw an error so that the UI can show an error message.
        this.log('error', `123test API Server error: Unknown api instrument response status '${status}'.`);
        this.triggerEvent('instrument-submit-failed', null, 'error');

        // Call itself, using the same accesscode. This enables waiting for a new for submit.
        return await this.processApiInstrumentResponse(accessCode,
          await this.processFormSubmit(accessCode),
        );
    }

    return {};
  }

  /**
   * Process a form submit event
   * @param {String} accessCode Access code of the instrument
   * @param {Object} submittedForm (Optional) object with two values: event and form.
   *                               This form is used instead of waiting for a new
   *                               submit event.
   */
  async processFormSubmit(accessCode, submittedForm = null) {
    let lastError = null;
    for (let i = 0; i < this.api.maxSubmitRetries; i += 1) {
      // Use already submitted form or wait for the form to submit
      // Only in first attempt
      const { form } = (i === 0 && submittedForm)
        ? submittedForm : await this.waitForInstrumentToSubmit();

      try {
        const result = await tryAtMost(this.api.maxHttpRetries, this.api.retryDelay, () =>
          this.submitInstrumentData(accessCode, form),
        );
        return result;
      } catch (error) {
        console.log('failed try at most');
        switch (error.status) {
          case 404:
            this.triggerEvent('instrument-run-not-found', null, 'error');
            // We cannot recover from a 404 in this state, throw error to break loop
            throw error;
          default:
            this.triggerEvent('instrument-submit-failed', null, 'error');
            break;
        }
        // Save error for later, we first let the user retry
        lastError = error;
      }
    }
    // Failed after max attempts, throw last error
    throw lastError;
  }

  /**
   * (Async) Request a product from the api
   *
   * Promise returns an object contains all the instruments
   * @param  {String} productId      ID of the product
   * @param  {String} user UUID v4
   * @return {Promise}
   */
  async requestProduct(productId, user) {
    const headers = {
      'Content-Type': 'application/json',
      'X-123test-ApiKey': this.api.apiKey,
      'X-123test-ProductId': productId,
    };
    if (user && user.length === 36) {
      headers['X-123test-Respondent'] = user;
    }

    try {
      const response = await request(`${this.api.endpoint}/product/request-product`, {
        method: 'GET',
        mode: 'cors',
        headers,
      });

      const json = await response.json();

      return {
        slots: json.slots,
        reports: json.reports,
        product_access_code: json.product_access_code,
      };
    } catch (error) {
      switch (error.status) {
        case 401:
          this.triggerEvent('invalid-api-key', error.response, 'error');
          break;
        case 400:
          this.triggerEvent('product-not-found', error.response, 'error');
          break;
        case 403:
          this.triggerEvent('product-no-access', error.response, 'error');
          break;
        default:
          // Do nothing
      }
      // Bubble-up error
      throw error;
    }
  }

  /**
   * Get information about a specific product running
   * @param  {String} accessCode Access code for product run
   * @return {Promise}
   */
  async requestProductInfo(accessCode) {
    const headers = {
      'Content-Type': 'application/json',
      'X-123test-ApiKey': this.api.apiKey,
    };

    const response = await request(`${this.api.endpoint}/product/${accessCode}/overview`, {
      method: 'GET',
      mode: 'cors',
      headers,
    });

    const json = await response.json();

    return {
      slots: json.slots,
      reports: json.reports,
      product_access_code: json.product_access_code,
    };
  }

  /**
   * (Async) Request an instrument from the api
   *
   * Promise returns body and resources that need to be loaded
   * @param  {String} accessCode Access code for the instrument
   * @return {Promise}
   */
  async requestInstrument(accessCode) {
    const response = await request(`${this.api.endpoint}/instrument/next-items`, {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'X-123test-ApiKey': this.api.apiKey,
        'X-123test-InstrumentRun': accessCode,
      },
    });

    const body = await response.text();
    return {
      body,
      status: response.headers.get('X-123test-InstrumentStatus'),
      resources: JSON.parse(response.headers.get('X-123test-Resources')),
    };
  }

  /**
   * Attach a listener to the instrument, makes use of a promise that resolves
   * when the button is clicked.
   * @return {Promise}
   */
  waitForInstrumentToSubmit() {
    const className = 'its123-disabled-loading';
    const form = document.querySelector(this.api.elements.instrumentFormSelector);
    const button = form.querySelector('button[type=submit]');

    // Re-enable button if it was previously disabled by this function
    if (button.classList.contains(className)) {
      this.enableSubmitButton();
    }

    // Return a new promise that resolves when the submit button is clicked
    return new Promise((resolve) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Disable submit button and add class so that we know that
        // the api js disabled the button (and not individual instrument js)
        this.disableSubmitButton();

        resolve({ form, event });
      });
    });
  }

  /**
   * Enable the submit button.
   * @return {void}
   */
  enableSubmitButton() {
    const className = 'its123-disabled-loading';
    const formEl = document.querySelector(this.api.elements.instrumentFormSelector);
    const button = formEl.querySelector('button[type=submit]');

    // Re-enable button if it was previously disabled
    if (button.classList.contains(className)) {
      button.disabled = false;
      button.innerHTML = (button.getAttribute('data-label')) ?
        button.getAttribute('data-label') : button.innerText;
      button.classList.remove(className);
    }
  }

  /**
   * Disable the submit button.
   * @return {void}
   */
  disableSubmitButton() {
    const className = 'its123-disabled-loading';
    const loadingIcon = '<div class="its123-loading-spinner"><div></div><div></div><div></div></div>';
    const form = document.querySelector(this.api.elements.instrumentFormSelector);
    const button = form.querySelector('button[type=submit]');

    button.disabled = true;
    button.classList.add(className);
    // Save content to an attribute to reset it later
    if (!button.getAttribute('data-label')) {
      button.setAttribute('data-label', button.innerText);
    }
    button.innerHTML = loadingIcon;
  }
  /**
   * Submit a form to the API for a given instrument
   * @param  {String} accessCode Access code of the instrument
   * @param  {Object} form       HTML Form
   * @return {Promise}
   */
  async submitInstrumentData(accessCode, form) {
    this.triggerEvent('instrument-submitting', accessCode);

    const response = await request(`${this.api.endpoint}/instrument/next-items`, {
      method: 'POST',
      cache: 'no-cache',
      body: new FormData(form),
      headers: {
        'X-123test-ApiKey': this.api.apiKey,
        'X-123test-InstrumentRun': accessCode,
        'X-123test-epochStart': this.api.epochStart,
        'X-123test-epochEnd': Its123.currentEpochTime(),
      },
    });

    const body = await response.text();

    return {
      body,
      status: response.headers.get('X-123test-InstrumentStatus'),
      resources: JSON.parse(response.headers.get('X-123test-Resources')),
    };
  }

  /**
   * Output an instrument to the DOM
   * @param  {String} body Instrument HTML
   * @return {void}
   */
  renderInstrument(body) {
    this.api.elements.productElement.innerHTML = body;
    this.api.elements.loadingElement.style.display = 'none';
    this.api.elements.productElement.style.display = 'block';
    this.api.elements.reportElement.style.display = 'none';
  }

  /**
   * Add event listeners to radio buttons in instruments
   * @param  {String} prefix Prefix string to for the store key (usually accessCode)
   * @return {null}
   */
  bindInstrumentStorageListeners(prefix) {
    if (!this.api.storageEnabled) {
      return;
    }

    const elements = this.api.elements.productElement.getElementsByTagName('input');

    for (let e = 0; e < elements.length; e += 1) {
      const input = elements[e];

      if (input.type === 'radio') {
        // Sync store with current value of the input element
        if (input.checked) {
          this.store.set(`${prefix}-${input.name}`, input.value);
        }
        input.addEventListener('change', () => {
          this.store.set(`${prefix}-${input.name}`, input.value);
        });
      }
    }
  }

  /**
   * Apply stored instrument state to the DOM
   * @param  {String} prefix Prefix string to for the store key (usually accessCode)
   * @return {null}
   */
  loadInstrumentStateFromStorage(prefix) {
    if (!this.api.storageEnabled) {
      return;
    }

    const elements = this.api.elements.productElement.getElementsByTagName('input');

    let loaded = false;
    for (let e = 0; e < elements.length; e += 1) {
      const input = elements[e];
      const value = this.store.get(`${prefix}-${input.name}`);

      if (value !== null && input.type === 'radio' && input.value === value) {
        input.checked = true;
        loaded = true;
      }
    }

    if (loaded) {
      this.triggerEvent('instrument-item-data-loaded', prefix);
    }
  }

  /**
   * Render a report to the DOM
   *
   * @param  {String} body report body
   * @return {Promise}
   */
  renderReport(body) {
    this.api.elements.productElement.style.display = 'none';
    this.api.elements.loadingElement.style.display = 'none';
    this.api.elements.reportElement.innerHTML = body;
    this.api.elements.reportElement.style.display = 'block';
  }

  /**
   * Add new resources to the DOM
   *
   * Returns a new Promise that resolves when all critical assets have been loaded
   * @param  {Object} resources The resources to load
   * @return {void}
   */
  static loadResources(resources) {
    if (!resources) {
      return null;
    }

    // Map each resource to a new Promise
    // JS resources resolve when loaded
    return Promise.all(Object.keys(resources).map(key => (
      new Promise((resolve, reject) => {
        const resourceItem = resources[key];
        const head = document.getElementsByTagName('head')[0];

        // Do not load resources that are already present
        if (document.querySelectorAll(`script[src="${resourceItem.path}"]`).length > 0) {
          resolve();
          return;
        }
        switch (resourceItem.type) {
          case 'js': {
            const script = document.createElement('script');
            script.src = resourceItem.path;
            // Allow some files to not load asynchronous
            script.async = resourceItem.async || false;
            // Resolve when loaded
            script.onload = resolve;
            // Append to the head of the page
            head.appendChild(script);
          }
            break;
          case 'css': {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.type = 'text/css';
            cssLink.media = 'all';
            cssLink.href = resourceItem.path;
            // Append to the head of the page
            head.appendChild(cssLink);

            // Directy resolve css, not critical
            resolve();
          }
            break;
          default:
            reject(`Unknown resource type ${resourceItem.type}`);
        }
      })
    )));
  }

  /**
   * Run functions for a list of JS resources
   * @param  {Object} resources
   * @return {void}
   */
  runResourceFunctions(resources) {
    Object.keys(resources).forEach((key) => {
      const resource = resources[key];
      if (resource.type === 'js'
        && typeof window.its123[resource.func] === 'function') {
        // Give context as variable
        window.its123[resource.func](this.api, this);
      }
    });
  }

  /**
   * Request a report by its access code
   * @param  {String} accessCode access code for the report
   * @param  {String} metaData  Base64 encoded meta data
   * @param  {String} metaHmac  HMAC for meta data
   * @return {Promise}
   */
  async requestReport(accessCode, { metaData = '', metaHmac = '' } = {}) {
    let url;
    if (metaData.length <= 0 || metaHmac.length <= 0) {
      url = `${this.api.endpoint}/report/${accessCode}`;
    } else {
      url = `${this.api.endpoint}/report/${accessCode}?meta=${metaData}&meta_hmac=${metaHmac}`;
    }

    const response = await request(url, {
      headers: {
        'X-123test-ApiKey': this.api.apiKey,
      },
      method: 'GET',
      mode: 'cors',
    });

    const body = await response.text();

    return {
      body,
      resources: JSON.parse(response.headers.get('X-123test-Resources')),
    };
  }

  /**
   * Log an exception and retrow
   * @param  {String} id Error id
   * @param  {Object} e The error
   * @param {Object} param Invoked parameter data
   * @return null
   */
  async handleException(id, e, param = {}) {
    switch (e.status) {
      case 401:
      case 403:
        this.log('error', `123test API Permission error: ${e.message} (${e.status})`);
        this.triggerEvent('api-permission', { status: 403, message: `${location.hostname} ${this.api.apiKey} ${this.api.productId}` }, 'error');
        return;
      case 404:
        this.log('error', `123test API Product error: ${e.message} (${e.status})`);
        break;
      case 408:
      case 503:
        this.log('error', '123test API Server error: API is unavailable');
        this.triggerEvent('api-unavailable', e, 'error');
        return;
      case 500:
        this.log('error', `123test API Server error: ${e.message} (${e.status})`);
        break;
      default:
        break;
    }

    // Trigger that a unhandled exception has occurred
    this.log('error', `123test API Server error: Error Unknown, '${e.message}', parameters: '${param}'`);
    this.triggerEvent('api-unavailable', e, 'error');
  }

  /**
   * Utility function to get the url to a PDF report for a given product object
   * @param  {Object} product               The product that contains the report list
   * @param  {String} [typeName='standard'] Can be 'standard' or 'premium'
   * @return {String}                       Url to the report
   */
  getPdfUrl(product, typeName = 'standard') {
    // Get correct type id for premium or standard pdf
    const type = (typeName === 'premium') ? 221 : 121;
    const report = product.reports.find(r => r.type === type);

    if (!report) {
      throw new Error('No access code for pdf is present in product object.');
    }

    return `${this.api.endpoint}/report/${report.access_code}`;
  }

  /**
   * Send a new event to the listeners
   * @param  {String} eventName Name of the event
   * @param  {Object} data      Optional event data
   * @param  {String} type      Event type
   * @return {void}
   */
  triggerEvent(eventName, data, type = 'info') {
    const listeners = this.eventListeners[eventName];

    if (listeners && listeners.length > 0) {
      listeners.forEach(l => l(data));
    }

    this.log(type, `Event triggered: ${eventName}`);
  }

  /**
   * Ouputs a message to the console based on the log logLevel
   * @param  {String} type    Type of the message
   * @param  {String} message The message itself
   * @return {null}
   */
  log(type, message) {
    switch (type) {
      case 'error':
        if (this.api.logLevel !== 'none') {
          console.error(message);
        }
        break;

      case 'info':
      default:
        if (this.api.logLevel !== 'error' || this.api.logLevel !== 'none') {
          console.info(message);
        }
        break;
    }
  }

  /**
   * Return current time in seconds.
   * @return {Number} Time in seconds
   */
  static currentEpochTime() {
    const now = new Date();
    const epoch = Math.round(now.getTime() / 1000);
    return epoch;
  }

  /**
   * Register a new event listener
   * @param  {String|Array}   eventName Name of the event
   * @param  {Function} callback
   * @return {void}
   */
  on(eventName, callback) {
    let events = [];

    if (Array.isArray(eventName)) {
      events = eventName;
    } else {
      events.push(eventName);
    }

    events.forEach((event) => {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = [];
      }

      this.eventListeners[event].push(callback);
    });
  }
}

export default Its123;
