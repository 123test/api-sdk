# Example PHP API 123TEST
## Static Example
* Open the test.html file
* Change the JS variable: {PUBLIC-API-KEY}
* The api is CORS protected, test the website with the correct browser url (example http://www.example.com:8081 instead of http://localhost:8081)

## Dynamic Example
* Open the test2.php file
* Define your own UUIDv4 identifier to bind your customer code with your database.
* Change the variables: $uuid, $productId, $user_id and $api_public_key
* Change also the variables in the file save-products.php: $user_id, $api_private_key
* The api is CORS protected, test the website with the correct browser url (example http://www.example.com:8081 instead of http://localhost:8081)

In this example, the product access code will be sent with the route: $productRouting -> /save-product.php?productId={product-access-code}.
You'll get information from the product. You could save this data in your own database.

