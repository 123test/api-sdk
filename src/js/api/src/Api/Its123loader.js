/*
* 123Test Api v2
*
* @author Wouter Bulten <github.com/wouterbulten>
* @author Theo den Hollander <github.com/theodenhollander>
* @license
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

import Its123 from './Its123';

   /**
    * Default configuration for api, can be overriden by user
    * @type {Object}
    */
const defaultApiConfig = {
  // Domain config
  domain: 'api.123test.com',
  version: 'v2',
  cdnDomain: 'cdn.123test.com',
  pdfType: 'none',

  // Environment config
  logErrors: true,
  environment: 'production',

  // DOM config
  elements: {
    loaderSelector: 'its123-loader-main',
    loaderSelectorScript: 'its123-loader-main-script',
    loaderSelectorCatalogus: 'its123api-catalogus',
  },

  apiKey: 'not-set',

};

class Its123loader {

  constructor(apiConfig = {}) {
  // Set api config to default and override with parameters
    this.api = {
      ...defaultApiConfig,
      ...apiConfig,
    };

    this.DOM = {};

    this.api.environment = (this.api.domain === 'https://api.123test.dev') ? 'development' : 'production';

    this.api.apiUrl = `https://${this.api.domain}/${this.api.version}/123test.json`;
    this.DOM.script = document.getElementById(`${this.api.elements.loaderSelectorScript}`);
    this.DOM.product = document.getElementById(`${this.api.elements.loaderSelector}`);

    this.api.scriptSrc = this.DOM.script.src;

    this.api.apiKey = Its123loader.getScriptParam('apikey', this.api.scriptSrc, 'not-set');
    if (this.api.apiKey === 'not-set') {
      throw new Error(
        'Api key must be set when initalising Its123 object. Please check your api config.',
      );
    }

    this.api.domain = Its123loader.getScriptParam('domain', this.api.scriptSrc, 'api.123test.com');
    this.api.cdnDomain = Its123loader.getScriptParam('cdnDomain', this.api.scriptSrc, 'cdn.123test.com');
    this.api.theme = Its123loader.getScriptParam('theme', this.api.scriptSrc, 'default');
    this.api.action = Its123loader.getScriptParam('action', this.api.scriptSrc, '');
    this.api.product = Its123loader.getScriptParam('product', this.api.scriptSrc, '');
    this.api.pdfType = Its123loader.getScriptParam('pdf', this.api.scriptSrc, 'none');
    this.api.language = Its123loader.getScriptParam('language', this.api.scriptSrc, 'en');
  }
 /**
 * Gets the parameter of a loaded javascript URL
 *
 * @param  {String} n parameter of the URL
 * @param  {String} s Javascript URL
 * @param  {String} defaultParam if the parameter is not found, the default value will be set
 * @return {String} The value of the parameter
 */
  static getScriptParam(n, s, defaultParam = '') {
    const n1 = n.replace(/[[]/, '[').replace(/^]/, ']');
    const p = (new RegExp(`[\\?&]${n1}=([^&#]*)`)).exec(s);
    return (p === null) ? defaultParam : p[1];
  }
  loadApiLibrary(callback) {
    const modernBrowser = typeof Promise !== 'undefined' && Promise.toString().indexOf('[native code]') !== -1 && window.fetch;
    if (!modernBrowser) {
      Its123loader.importScript(`https://${this.api.cdnDomain}/assets/api/js/latest/its123api.polyfill.min.js`, callback);
    } else if (location.hostname === 'developer.123test.dev') {
      Its123loader.importScript('its123api.js', callback);
    } else {
      Its123loader.importScript(`https://${this.api.cdnDomain}/assets/api/js/latest/its123api.min.js`, callback);
    }
  }
  static importScript(src, callback) {
    const oScript = document.createElement('script');
    oScript.type = 'text/javascript';
    oScript.src = src;
    oScript.onload = callback;
    const s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(oScript, s);
  }
  loadScripts() {
    const its123Style = document.createElement('link');
    its123Style.rel = 'stylesheet';
    its123Style.type = 'text/css';
    its123Style.href = `https://${this.api.cdnDomain}/assets/api/styles/11/themes/${this.api.theme}.css`;
    its123Style.media = 'all';
    this.DOM.product.appendChild(its123Style);

    let messageFeedback = '';
    switch (this.api.language) {
      case 'nl':
        messageFeedback = `<div id='its123api-permission-message' class='its123-alert its123-error' style='display: none;'>
                Geen tot toegang tot het volgende domain / api-key:
              </div>
              <div id='its123api-catalogus-not-found' class='its123-alert its123-error' style='display: none;'>
                Catalogus {catalogus-name} niet gevonden. Status:
              </div>
              <div id='its123api-unavailable-message' class='its123-alert its123-error' style='display: none;'><p>
                Het is dit op dit moment niet mogelijk om een test te starten. Probeer het over een paar minuten nogmaals door de pagina te herladen.'
                </p>
              </div>
              <div id='its123api-error-message' class='its123-alert its123-error' style='display: none;'><p>
                  Er is een fout opgetreden, excuses voor het ongemak. Herlaad de pagina om het opnieuw te proberen.</p></div>
              <div id='its123api-submit-failed-message' class='its123-alert its123-error' style='display: none;'><p>
              Het is dit op dit moment niet mogelijk om de testresultaten in te dienen. Probeer het over een paar minuten nogmaals door de pagina te herladen.
              </p></div>`;
        break;
      default:
      case 'en':
        messageFeedback = `<div id='its123api-permission-message' class='its123-alert its123-error' style='display: none;'>
              No permission to get access with the following domain, api-key combination:
            </div>
            <div id='its123api-catalogus-not-found' class='its123-alert its123-error' style='display: none;'>
              Catalogus {catalogus-name} not found. Status:
            </div>
            <div id='its123api-unavailable-message' class='its123-alert its123-error' style='display: none;'><p>It is currently not possible to start or submit a test.
              Please check your internet connection and try again in a few minutes by reloading the page.
              </p>
            </div>
            <div id='its123api-error-message' class='its123-alert its123-error' style='display: none;'><p>
                An unexpected error occurred. We are sorry for the inconvenience. Please try to
                reload the page.</p></div>
            <div id='its123api-submit-failed-message' class='its123-alert its123-error' style='display: none;'><p>
            An error occurred when submitting your test data. Please,check your internet connection and try again in a few minutes.
            </p></div>`;
        break;
    }

    const its123Product = document.createElement('div');
    its123Product.innerHTML = `
    <div class='its123-container'>
      <div class="its123-alert its123-info its123-loading-indicator" id="its123api-loading">
        <div class="its123-loading-spinner">
            <div></div>
            <div></div>
            <div></div>
        </div>
      </div>
      ${messageFeedback}
      <div id="its123api-catalogus">
      </div>
      <div id="its123api-product">
      </div>
      <a href="#" id="its123api-download-pdf" style="display: none">Download PDF</a>
      <div id="its123api-report">
      </div>
    </div>`;

    this.DOM.product.appendChild(its123Product);
    this.DOM.catalogus = document.getElementById(`${this.api.elements.loaderSelectorCatalogus}`);

    this.executeAction(this.api.action);
  }
  executeAction(its123Action) {
    switch (its123Action) {
      case 'load-catalogus':
        this.loadCatalogus();
        break;
      case 'load-product':
        this.loadProduct(this.api.product);
        break;
      default:
        throw new Error(`Action ${its123Action} not found.`);
    }
  }
  async loadCatalogus() {
    let content = '';
    try {
      const response = await fetch(`https://${this.api.cdnDomain}/content/api/${this.api.product}.php`, {
        method: 'GET',
      });
      content = await response.text();
    } catch (error) {
      document.getElementById('its123api-loading').style.display = 'none';
      const permissionBlock = document.getElementById('its123api-catalogus-not-found');
      permissionBlock.style.display = 'block';
      permissionBlock.innerHTML = `<p>${permissionBlock.innerHTML.replace('{catalogus-name}', this.api.product)} ${error.status}</p>`;

      throw error;
    }

    const its123Catalogus = document.createElement('div');
    its123Catalogus.innerHTML = content;
    document.getElementById('its123api-loading').style.display = 'none';

    this.DOM.catalogus.appendChild(its123Catalogus);

    const oScript = document.createElement('script');
    oScript.type = 'text/javascript';
    oScript.src = `https://${this.api.cdnDomain}/content/api/${this.api.product}_js.php`;

    this.DOM.product.appendChild(oScript);
  }
  loadCatalogusItem(product) {
    Array.from(document.getElementsByClassName('its123-catalogus'))
    .forEach((c) => {
      const catalogusItem = c;
      catalogusItem.style.display = 'none';
    });

    const productIntro = document.getElementById(`${product}_product-introduction`);

    if (productIntro != null) {
      productIntro.style.display = 'block';
    }

    this.loadProduct(product);
  }
  loadProduct(productCatalogus) {
    this.loadApiLibrary(() => {
      const api = new Its123({
        apiKey: this.api.apiKey,
        domain: `https://${this.api.domain}`,
      });
      // Error Presentation view
      api.on(['instrument-already-completed', 'instrument-item-data-loaded', 'instrument-continue'], () => {
        document.getElementById('its123api-loading').style.display = 'none';
        document.getElementById('its123api-continued-message').style.display = 'block';
      });
      api.on('api-permission', (error) => {
        document.getElementById('its123api-loading').style.display = 'none';
        const permissionBlock = document.getElementById('its123api-permission-message');
        permissionBlock.style.display = 'block';
        permissionBlock.innerHTML = `<p>${permissionBlock.innerHTML} ${error.message}</p>`;
      });
      api.on('error', (error) => {
        if (error.status !== 408) {
          document.getElementById('its123api-loading').style.display = 'none';
          document.getElementById('its123api-error-message').style.display = 'block';
        }
      });
      api.on('api-unavailable', () => {
        document.getElementById('its123api-loading').style.display = 'none';
        document.getElementById('its123api-unavailable-message').style.display = 'block';
      });
      api.on('instrument-submit-failed', () => {
        document.getElementById('its123api-loading').style.display = 'none';
        document.getElementById('its123api-submit-failed-message').style.display = 'block';
      });
      api.on('instrument-submitting', () => {
        document.getElementById('its123api-loading').style.display = 'none';
        document.getElementById('its123api-submit-failed-message').style.display = 'none';
      });
      api.loadProduct(productCatalogus).then((product) => {
        if (this.api.pdfType !== 'none') {
          const url = api.getPdfUrl(product, this.api.pdfType);
          const button = document.getElementById('its123api-download-pdf');
          button.href = url;
          button.style.display = 'block';
        }
        const productIntro = document.getElementById(`${productCatalogus}_product-introduction`);

        if (productIntro != null) {
          productIntro.style.display = 'none';
        }

        const productReportIntro = document.getElementById(`${productCatalogus}_report-introduction`);

        if (productReportIntro != null) {
          productReportIntro.style.display = 'block';
        }
      });
    });
  }
}

export default Its123loader;
