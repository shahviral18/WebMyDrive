const https = require('https');
const querystring = require('querystring');
const fs = require('fs');

const loginPhpContent = `<?php
header("Content-Type: application/json");
error_reporting(0);
ini_set('display_errors', 0);

$email = $_POST['email'] ?? '';
$password = $_POST['password'] ?? '';

if (!$email || !$password) {
    echo json_encode(["success" => false, "message" => "Invalid credentials"]);
    exit;
}

$conn = mysqli_connect(
  "localhost",
  "wmdtest_webmydrive_user",
  "Webmydrive123",
  "wmdtest_webmydrive_db"
);

if (!$conn) {
    echo json_encode(["success" => false, "message" => "Database connection failed"]);
    exit;
}

$safe_email = mysqli_real_escape_string($conn, $email);
$result = mysqli_query($conn, "SELECT * FROM users WHERE email='$safe_email'");

if ($result && mysqli_num_rows($result) > 0) {
    $row = mysqli_fetch_assoc($result);
    if (password_verify($password, $row['password'])) {
        echo json_encode([
            "success" => true,
            "token" => "dummy-token",
            "user" => [
                "id" => $row['id'],
                "email" => $row['email'],
                "name" => $row['name'] ?? '',
                "role" => $row['role'] ?? 'user'
            ]
        ]);
        exit;
    }
}

echo json_encode(["success" => false, "message" => "Invalid credentials"]);
exit;
`;

const postData = querystring.stringify({
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'savefile',
    dir: 'public_html/WebMyDrive/demo/1',
    filename: 'login.php',
    content: loginPhpContent
});

const options = {
    hostname: 'test.webmydrive.com',
    port: 2083,
    path: '/json-api/cpanel',
    method: 'POST',
    headers: {
        'Authorization': 'cpanel wmdtest:JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
    },
    rejectUnauthorized: false
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => console.log('Upload Result:', data));
});

req.write(postData);
req.end();
