<?php

$conn = mysqli_connect(
    "localhost",
    "wmdtest_webmydrive_user",
    "YOUR_PASSWORD",
    "wmdtest_webmydrive_db"
);

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

// Create hash
$newHash = password_hash('admin123', PASSWORD_BCRYPT);

// Update user
$sql = "UPDATE users SET password = '$newHash' WHERE email = 'admin@webmydrive.com'";
$result = mysqli_query($conn, $sql);

echo "Rows updated: " . mysqli_affected_rows($conn) . "<br>";

// Verify
$result = mysqli_query($conn, "SELECT password FROM users WHERE email='admin@webmydrive.com'");
$row = mysqli_fetch_assoc($result);

$ok = password_verify('admin123', $row['password']);

echo "Verify admin123: " . ($ok ? "SUCCESS ✓" : "FAILED ✗");

?>