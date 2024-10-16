<?php

class ApiLoader {


    /**
     * @var string API publickey
     */
    private $apiPublicKey;

    /**
     * @var @string Client
     */
    private $apiClient;

    /**
     * @var @string Api endpoint
     */
    private $apiHost;

    /**
     * @var string Api endpoint
     */
    private $productRouteEndpoint;

    /**
     * @var string $language
     */
    private $language;

    /**
     * @var bool debug flag
     */
    private $debugMode = false;

    /**
     * @var string dynamic_js Javascript needed to load the api
     */
    public $dynamicJS = "";

    /**
     * @var string dynamicContent HTML Content needed to load the api
     */
    public $dynamicContent = "";

    /**
     * @param string $apiClient The client id
     * @param string $apiPublicKey Public api key
     * @param $apiHost
     * @param string $productRouteEndpoint When the test is completed, the data will be sent to your route. In this event you could save your results. The last parameter is the product-access-code, example: "/save-product.php?productId="
     * @param string $language
     * @param bool $debugMode Not in your production environment!
     */
    public function __construct($apiClient, $apiPublicKey,  $apiHost, $productRouteEndpoint, $language = 'EN', $debugMode = false)
    {
        $this->apiClient = $apiClient;
        $this->apiPublicKey = $apiPublicKey;
        $this->apiHost = $apiHost;
        $this->productRouteEndpoint = $productRouteEndpoint;
        $this->language = $language;
        $this->debugMode = $debugMode;

       
    }

    function api_load_product($productId, $uuid, $productData = null)
    {
        
        $this->dynamicJS = "
    window.startIts123Api = function(uuid) {
        window.loadIts123Api=function(a,b,c){var d=\"undefined\"!=typeof Promise&&Promise.toString().indexOf(\"[native code]\")!==-1&&window.fetch,e=function(a,b){var c=document.createElement(\"script\");c.type=\"text/javascript\",c.src=a,c.onload=b;var d=document.getElementsByTagName(\"script\")[0];d.parentNode.insertBefore(c,d)};d?e(a+\"/dist/\"+b+\"/its123api.min.js\",c):e(a+\"/assets/api/js/\"+b+\"/its123api.polyfill.min.js\",c)};
    
        var startApi = function () {
            
            var api = new Its123({
                domain: '" . $this->apiHost . "',
                apiKey: '" . $this->apiPublicKey . "'";

            if ($productData != null) {

                $this->dynamicJS .= ", productData: " . json_encode($productData);
            }    
        
            $this->dynamicJS .= "});
            
            console.log(api.productData);

            api.on(['instrument-already-completed', 'instrument-item-data-loaded', 'instrument-continue'], function() {
                document.getElementById('its123api-loading').style.display = 'none';
                $('#its123api-continued-message').show();
                
            });
 
            api.on('error', function(error) {
                if(error.status !== 408) {
                    document.getElementById('its123api-loading').style.display = 'none';
                    $('#its123api-error-message').show();
                }
            });
            api.on('api-unavailable', function() {
                document.getElementById('its123api-loading').style.display = 'none';
                $('#its123api-unavailable-message').show();
            });
            api.on('instrument-submit-failed', function() {
                document.getElementById('its123api-loading').style.display = 'none';
                $('#its123api-submit-failed-message').show();
            });
            api.on('instrument-submitting', function() {
                document.getElementById('its123api-loading').style.display = 'block';
                $('#its123api-submit-failed-message').hide();
                $('.its123api-brochure').hide();
            });
            api.on('product-loaded', function(product) {
                console.log(product);
                var request = $.ajax({
                    url: '" . $this->productRouteEndpoint . "' + product.product_access_code,
                    type: 'GET',
                    cache: false,
                    dataType: 'json'
                });
            });
            api.loadProduct('" . $productId . "', { renderReport: false, user: uuid });
            
            $('#its123api-continued-message a').click(function() {
                document.getElementById('its123api-loading').style.display = 'block';
                $('#its123api-continued-message').hide();
                localStorage.removeItem('its123Api-" . $productId . "');
                api.restartProduct('" . $productId . "',  { renderReport: true, user: uuid });
            });
        };
        
        loadIts123Api('', 'js', startApi);
    };
    
    window.startIts123Api('" . $uuid . "');
    ";

        switch ($this->language) {
            case 'NL':
                $startOverMsg = 'Je hebt een deel van deze test al ingevuld, je kunt nu verdergaan waar je gebleven was. Wil je liever opnieuw beginnen? Klik dan op de knop hieronder.';
                $errorMsg = 'Er is een fout opgetreden bij het laden of opsturen van de test. Herlaad de pagina om het opnieuw te proberen.';
                $submitErrorMsg = 'Er is een fout opgetreden bij het opsturen van je antwoorden. Controleer je internetverbinding en probeer het over een paar minuten opnieuw.';
                $unavailableMsg = 'Het is dit op dit moment niet mogelijk om een test te maken of in te vullen. Controleer je internetverbinding en probeer het over een paar minuten nogmaals door de pagina te herladen.';
                $startOverBtn = 'Begin opnieuw';
                break;
            default:
                $startOverMsg = 'You\'ve already filled out part of this test. You can continue where you left off or click the button below if you’d rather start over.';
                $errorMsg = 'An unexpected error occurred. We are sorry for the inconvenience. Please try to reload the page.';
                $submitErrorMsg = 'An error occurred when submitting your test data. Please check your internet connection and try again in a few minutes.';
                $unavailableMsg = 'It is currently not possible to start or submit a test. Please check your internet connection and try again in a few minutes by reloading the page.';
                $startOverBtn = 'Start over';
        }
        $this->dynamicContent = "
        <div id='its123api-continued-message' class='alert alert-info' style='display: none'>
            <p>" . $startOverMsg . "</p>
            <a class='btn btn-primary'>" . $startOverBtn . "</a>
        </div>
        
        
        <div id=\"its123api-loading\" class=\"its123-alert its123-info its123-loading-indicator\">
        <div class=\"its123-loading-spinner\">
            <div></div>
            <div></div>
            <div></div>
        </div>
         </div>
        <div id=\"its123api-product\" class='its123-container'>
            <!-- Instruments are rendered in this div, keep empty -->
        </div>
        
        <div id='its123api-unavailable-message' class='alert alert-danger' style='display: none;'>
            <p>$unavailableMsg</p>
        </div>
        <div id='its123api-error-message' class='alert alert-danger' style='display: none;'>
            <p>$errorMsg</p>
        </div>
        <div id='its123api-submit-failed-message' class='alert alert-danger' style='display: none;'>
            <p>$submitErrorMsg</p>
        </div>
        
        <div id=\"its123api-report\" class='its123-container'>
            <!-- HTML reports are rendered in this div, keep empty -->
        </div>

    ";
    }

}


