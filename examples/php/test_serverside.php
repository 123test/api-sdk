<?php

require_once('lib/ApiLoaderServerSide.php');
require_once('lib/Its123Handler.php');

//Customer Unique UUIDv4, example: '5414fc19-3d10-49de-ab1f-ced61a3d0f5b'
$uuid = '{ UUIDv4 }';

//Product name: Example: competentietest-nl_nl-1
$productId = '{ PRODUCT-NAME }';

//When the test is completed, the data will be sent to your route. In this event you could save your results (report access-code etc). The last parameter is the product-access-code, example: "/save-product.php?productId="
$productRouting = "/save-product.php?productId=";

$api_debug = true;
$api_protocol = 'https';
$api_version = 'v2';
$api_domain = 'api.123test.com';
$user_id = '{ USER-ID }';
$api_public_key = '{ PUBLIC API-KEY }'; //Public api keys
$api_private_key = '{ PRIVATE API-KEY }'; //Private api keys

//Create your custom environment variables
include('env.php');

$ApiHandlerManager = new Its123Handler($user_id, $api_private_key, $api_debug);
$ApiHandlerManager->setEndPoint($api_protocol, $api_domain, $api_version);




//Get the product Info server side
$data = $ApiHandlerManager->requestAccess($productId, 'apisdktest', []);

$server_reports = $data['reports'];
unset($data['reports']);

//die(var_dump($server_reports));
//Initiate ApiLoader
$language = 'EN';


$apiLoader = new ApiLoader($user_id, $api_public_key, "https://" . $api_domain, $productRouting, $language);
$apiLoader->api_load_product($productId, $uuid, $data);

?>
<!DOCTYPE html>
<html>
<head>
    <title>123test API example</title>
    <meta name="viewport" content="initial-scale=1.0, user-scalable=no">
    <meta charset="utf-8">

    <link href="//cdn.123test.com/assets/api/styles/latest/themes/123test.css" type="text/css" rel="stylesheet">

    <style type="text/css">
        /* Optional css to center the test */
        .its123-container {
    margin: 0 auto;
            max-width: 920px;
        }
    </style>
</head>
<body>
<h1>Load Api Product</h1>
    <?php echo $apiLoader->dynamicContent;?>
<script src="//code.jquery.com/jquery-1.11.0.min.js"></script>
<script type='text/javascript'>
    <?php echo $apiLoader->dynamicJS;?>
</script>
</body>
</html>
