<?php
/**
 * EXAMPLE PHP API SDK
 * User: theo
 * Date: 13-01-15
 * Time: 11:43
 */

//Development configuration: $api_domain, $user_id, $api_public_key and $api_private_key
$api_domain = 'api.123test.com';
$user_id = '{ API-USER-ID }';
$api_private_key = '{ PRIVATE API-KEY }'; // PRIVATE KEY, only server side!!

//Product-configuration
$api_version = 'v2';

//ToDo Security checks
$productAccessCode = $_REQUEST['productId'];

require_once('lib/Its123Handler.php');

$handler = new Its123Handler($user_id, $api_private_key, true);
$handler->setEndPoint('https', $api_domain, $api_version);


$accessCodes = $handler->requestAction($productAccessCode . '/overview');

//TODO: SAVE THIS DATA TO YOUR DATABASE, DISABLE THIS
echo "<h1>Result Access Data, save this to your database</h1>";
print_r($accessCodes);
