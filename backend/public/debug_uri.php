<?php
header("Content-Type: application/json");
echo json_encode([
  "REQUEST_URI" => $_SERVER["REQUEST_URI"],
  "PATH_INFO" => $_SERVER["PATH_INFO"] ?? null,
  "SCRIPT_NAME" => $_SERVER["SCRIPT_NAME"],
  "body" => file_get_contents("php://input"),
  "CONTENT_TYPE" => $_SERVER["CONTENT_TYPE"] ?? null,
]);
?>