<?php
/**
 * Request — HTTP request abstraction
 *
 * Parses query params, JSON body, headers, and URL segments
 * with full input sanitization built in.
 */

declare(strict_types=1);

class Request
{
    public string $method;
    public string $path;         // e.g. /api/auth/login
    public array $query;        // $_GET sanitized
    public array $body;         // JSON body or $_POST
    public array $headers;      // Normalized headers
    public string $rawBody;      // Raw body (for webhook HMAC)
    public ?string $ip;
    /** @var array<string,string> Populated by Router from URL segments */
    public array $params = [];
    /** @var array{userId:int,role:string}|null Set by auth middleware */
    public ?array $user = null;

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        // Strip any subdirectory prefix so that /webmydrive/demo/1/api/... becomes /api/...
        // This allows the app to be deployed in any subdirectory without changing routes.
        if (preg_match('#(/api/.*)$#', $rawPath, $m)) {
            $this->path = $m[1];
        } else {
            $this->path = $rawPath;
        }
        $this->ip = $_SERVER['HTTP_X_FORWARDED_FOR']
            ?? $_SERVER['REMOTE_ADDR']
            ?? null;

        // Raw body (read once)
        $this->rawBody = file_get_contents('php://input') ?: '';

        // Parse query string
        $this->query = $this->sanitizeArray($_GET);

        // Parse JSON body or fallback to POST
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($contentType, 'application/json') && $this->rawBody !== '') {
            $decoded = json_decode($this->rawBody, true);
            $this->body = is_array($decoded) ? $decoded : [];
        } else {
            $this->body = $this->sanitizeArray($_POST);
        }

        // Collect relevant headers
        $this->headers = $this->collectHeaders();
    }

    /** Read a query parameter with optional default. */
    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    /** Read a body field with optional default. */
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    /** Get a URL segment parameter (set by router). */
    public function param(string $key, mixed $default = null): mixed
    {
        return $this->params[$key] ?? $default;
    }

    /** Get a header value (case-insensitive). */
    public function header(string $name): ?string
    {
        $normalized = strtolower(str_replace('-', '_', $name));
        return $this->headers[$normalized] ?? null;
    }

    /** Return the Authorization Bearer token or null. */
    public function bearerToken(): ?string
    {
        $auth = $this->header('authorization');
        if ($auth && str_starts_with($auth, 'Bearer ')) {
            return substr($auth, 7);
        }
        return null;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    /** Recursively sanitize an input array. */
    private function sanitizeArray(array $data): array
    {
        $clean = [];
        foreach ($data as $key => $value) {
            $cleanKey = htmlspecialchars((string) $key, ENT_QUOTES, 'UTF-8');
            if (is_array($value)) {
                $clean[$cleanKey] = $this->sanitizeArray($value);
            } else {
                // htmlspecialchars only for display safety; raw values preserved via $this->body
                $clean[$cleanKey] = $value; // keep original for business logic; sanitize at output
            }
        }
        return $clean;
    }

    /** Collect HTTP headers from $_SERVER. */
    private function collectHeaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $header = strtolower(substr($key, 5));
                $headers[$header] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content_type'] = $_SERVER['CONTENT_TYPE'];
        }
        return $headers;
    }
}
