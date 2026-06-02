<?php
/**
 * Router — Lightweight Front-Controller Router
 *
 * Maps HTTP method + path pattern to a controller callable.
 * Supports named URL parameters: /users/:id/adjust-wallet
 *
 * Usage in public/index.php:
 *   $router = new Router($request);
 *   $router->get('/api/health',  [HealthController::class, 'ping']);
 *   $router->post('/api/auth/login', [AuthController::class, 'login']);
 *   $router->dispatch();
 */

declare(strict_types=1);

class Router
{
    private Request $request;
    /** @var array<int, array{method:string, pattern:string, keys:array, handler:callable}> */
    private array $routes = [];
    /** @var callable[] */
    private array $globalMiddleware = [];

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    // ── Route registration ────────────────────────────────────────────────────

    public function get(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('GET', $path, $handler, $middleware);
    }

    public function post(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('POST', $path, $handler, $middleware);
    }

    public function put(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('PUT', $path, $handler, $middleware);
    }

    public function patch(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('PATCH', $path, $handler, $middleware);
    }

    public function delete(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('DELETE', $path, $handler, $middleware);
    }

    /** Register a global middleware that runs before every handler. */
    public function use(callable $middleware): self
    {
        $this->globalMiddleware[] = $middleware;
        return $this;
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    /**
     * Match the current request against registered routes and call handler.
     * Responds with 404 / 405 if no match is found.
     */
    public function dispatch(): void
    {
        $method = strtoupper($this->request->method);
        $path = rtrim($this->request->path, '/') ?: '/';

        // Handle CORS preflight
        if ($method === 'OPTIONS') {
            Response::handleOptions();
        }

        $matched = false;
        $methodAllowed = false;

        foreach ($this->routes as $route) {
            $params = $this->match($route['pattern'], $route['keys'], $path);

            if ($params === null) {
                continue; // path doesn't match
            }

            $matched = true;

            if ($route['method'] !== $method) {
                $methodAllowed = true; // path matches but wrong method
                continue;
            }

            // Populate URL params on the request
            $this->request->params = $params;

            // Run global middleware
            foreach ($this->globalMiddleware as $mw) {
                $mw($this->request);
            }

            // Run route-specific middleware
            foreach ($route['middleware'] as $mw) {
                $mw($this->request);
            }

            // Call handler
            $handler = $route['handler'];
            if (is_array($handler)) {
                [$class, $method] = $handler;
                (new $class())->$method($this->request);
            } else {
                $handler($this->request);
            }

            return;
        }

        // No route matched
        if ($matched && $methodAllowed) {
            Response::error('Method Not Allowed', 405);
        }
        Response::error('Not Found', 404);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function addRoute(string $method, string $path, callable|array $handler, array $middleware): self
    {
        [$pattern, $keys] = $this->compilePattern($path);
        $this->routes[] = compact('method', 'pattern', 'keys', 'handler', 'middleware');
        return $this;
    }

    /**
     * Convert an Express-style path (/users/:id) to a regex pattern.
     * Returns [pattern, paramNames].
     */
    private function compilePattern(string $path): array
    {
        $keys = [];
        $escaped = preg_replace('/\//', '\\/', $path);
        $pattern = preg_replace_callback('/:([a-zA-Z_][a-zA-Z0-9_]*)/', function (array $m) use (&$keys) {
            $keys[] = $m[1];
            return '([^\/]+)';
        }, $escaped);
        return ["#^{$pattern}\/?$#", $keys];
    }

    /**
     * Match a URL path against a compiled pattern.
     * Returns assoc array of params, or null if no match.
     */
    private function match(string $pattern, array $keys, string $path): ?array
    {
        if (!preg_match($pattern, $path, $matches)) {
            return null;
        }
        array_shift($matches); // remove full match
        return array_combine($keys, $matches) ?: [];
    }
}
