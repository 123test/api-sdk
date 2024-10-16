<?php

/**
 * Class Its123Handler
 *
 * Recommend way to interface with the 123test API by external parties.
 *
 * @author Wouter Bulten
 * @author Theo den Hollander
 * @version 4.0
 */
class Its123Handler
{

    /**
     * @var string API key
     */
    private $apiKey;

    /**
     * @var @string Client
     */
    private $apiClient;

    /**
     * @var string URL we use as endpoint
     */
    private $apiEndpoint = 'v2';

    /**
     * @var string Protocol for the requests
     */
    private $protocol = 'https';

    /**
     * @var string Default host
     */
    private $host = 'api.123test.com';

    /**
     * @var bool debug flag
     */
    private $debugMode = false;

    /**
     * @param string $apiClient The client id
     * @param string $apiKey Secret api key
     * @param bool $debugMode Not in your production environment!
     */
    public function __construct($apiClient, $apiKey, $debugMode = false)
    {
        $this->apiClient = $apiClient;
        $this->apiKey = $apiKey;
        $this->debugMode = $debugMode;
    }

    /**
     * Set the api end point to a different value
     * Only used for testing purposes.
     * @param string $protocol http/https
     * @param string $host host endpoint
     * @param string $endpoint
     */
    public function setEndPoint($protocol, $host, $endpoint)
    {
        $this->protocol = $protocol;
        $this->host = $host;
        $this->apiEndpoint = $endpoint;
    }

    /**
     * Request access to a specific product
     * @param string $productId The id of the product (required)
     * @param bool $verifySsl If set to false the SSL certificate is not validated (optional)
     * @param string $ca_bundle_path If verifySsl set to true, the path of the trusted CA certification (http://curl.haxx.se/docs/sslcerts.html / https://www.geotrust.com/resources/extended-validation-ssl/installation-instructions.html) (optional)
     * @param string $channel channel of your business (required)
     * @param string[] $data of your request (optional)
     * @return Object containing the access code and session key
     * @throws Exception
     */
    public function requestProduct($productId, $verifySsl = true, $ca_bundle_path = null, $channel = "default", $data = array())
    {
        return $this->requestAction("request-product",  $verifySsl, $ca_bundle_path, $channel, $productId, null, $data);
    }

     /**
     * Request access to a specific product
     * @param string $productId The id of the product
     * @param string $channel channel of your business
     * @param string[] $data of your request
     * @return Object containing the access code and session key
     * @throws \Exception
     */
    public function requestAccess(
        $productId,
        $channel = "default",
        $data = array()
    ) {
        return $this->requestAction("request-product", $verifySsl = true, $ca_bundle_path = null, $channel, $productId, null, $data);
    }

    /**
     * Request an specific action of the product
     * @param string $action method of the product (required)
     * @param bool $verifySsl If set to false the SSL certificate is not validated (required)
     * @param string $ca_bundle_path If verifySsl set to true, the path of the trusted CA certification (http://curl.haxx.se/docs/sslcerts.html / https://www.geotrust.com/resources/extended-validation-ssl/installation-instructions.html) (optional)
     * @param string $channel channel of your business (required)
     * @param string $productId The id of the product (optional)
     * @param string $accessCode The access code of the product (optional)
     * @param string[] $data array list with data needed for the action (optional)
     * @return Object containing the response of the action
     * @throws Exception
     */
    public function requestAction($action = "request-product", $verifySsl = true, $ca_bundle_path = null, $channel = "default", $productId = null, $accessCode = null, $data = array())
    {
        if($this->apiClient == null)
        {
            throw new \Exception("Api client is not correct");
        }

        $epochTime = time();
        $requestData = [
            'Content-Type: application/json',
            'X-123test-ApiKey: '    . $this->apiKey,
            'X-123test-Client-id: ' . $this->apiClient,
            'X-123test-Timestamp: ' . $epochTime,
            'X-123test-ProductId: ' . $productId,
            'X-123test-Channel: '   . $channel,
            'timestamp: ' . $epochTime
        ];

        foreach ($data as $key => $value)
        {
            $requestData[] = "$key: $value";
        }

        $url = $this->protocol . '://' . $this->host . '/' . $this->apiEndpoint . '/product/' . $action;

        $ch = curl_init($url);

        if($this->debugMode)
        {
            curl_setopt($ch, CURLOPT_VERBOSE, true);
        }

        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, $verifySsl);

        if($verifySsl && $ca_bundle_path != null)
        {
            curl_setopt($ch, CURLOPT_CAPATH, $ca_bundle_path);
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLINFO_HEADER_OUT, $this->debugMode);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $requestData);

        $result = curl_exec($ch);
        //var_dump(curl_getinfo($ch));

        if($this->debugMode && curl_errno($ch))
        {
            throw new \Exception(print_r('error general curl:' . curl_error($ch), true));
        }

        $jsonResult = json_decode($result, true);

        if (is_null($jsonResult) || ($action == "request-product" && (!isset($jsonResult['product_access_code']) || is_null($jsonResult['product_access_code'])))) {

            if($this->debugMode)
            {
                print_r($jsonResult);
            }

            throw new \Exception("API Request failed with result" . print_r($jsonResult, true));
        }
        
        return $jsonResult;
    }
}
