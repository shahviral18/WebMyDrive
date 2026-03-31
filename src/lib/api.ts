/**
 * API utility for making authenticated requests to the backend server.
 */

const getHeaders = () => {
    // User token is in localStorage; admin token is in sessionStorage
    // Checking sessionStorage first ensures Admin tokens override old User tokens
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

// Calculate API base URL
let BASE_API_URL = import.meta.env.VITE_API_URL || "";
if (!import.meta.env.DEV && (BASE_API_URL.includes("localhost") || BASE_API_URL.includes("192.168") || BASE_API_URL.includes("127.0.0.1"))) {
    BASE_API_URL = "";
}

export const getApiUrl = (endpoint: string) => {
    if (BASE_API_URL) {
        return `${BASE_API_URL}/api${endpoint}`;
    }
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    // Backend was moved to /backend/ so we route API calls to its public/ entrypoint
    // The PHP router automatically strips prefixes to match /api/...
    return `${base}/backend/public/api${endpoint}`;
};

const handleResponse = async (res: Response) => {
    if (res.status === 204) return null;

    let data;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        data = await res.json();
    } else {
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`Server returned ${res.status} ${res.statusText} (Non-JSON). Is the backend running?`);
        }
        return text;
    }

    if (!res.ok) {
        throw new Error(data?.error || `Request failed with status ${res.status}`);
    }

    return data;
};

export const api = {
    async get(endpoint: string) {
        const res = await fetch(getApiUrl(endpoint), {
            method: "GET",
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    async post(endpoint: string, data: any) {
        const res = await fetch(getApiUrl(endpoint), {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    async put(endpoint: string, data: any) {
        const res = await fetch(getApiUrl(endpoint), {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    async delete(endpoint: string) {
        const res = await fetch(getApiUrl(endpoint), {
            method: "DELETE",
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    async patch(endpoint: string, data: any) {
        const res = await fetch(getApiUrl(endpoint), {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    }
};
