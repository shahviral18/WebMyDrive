/**
 * API utility for making authenticated requests to the backend server.
 */

const getHeaders = () => {
    // User token is in localStorage; admin token is in sessionStorage
    // Checking sessionStorage first ensures Admin tokens override old User tokens
    const token = sessionStorage.getItem("wmd_token") || localStorage.getItem("wmd_token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
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
        const res = await fetch(`/api${endpoint}`, {
            method: "GET",
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    async post(endpoint: string, data: any) {
        const res = await fetch(`/api${endpoint}`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    async put(endpoint: string, data: any) {
        const res = await fetch(`/api${endpoint}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    async delete(endpoint: string) {
        const res = await fetch(`/api${endpoint}`, {
            method: "DELETE",
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    async patch(endpoint: string, data: any) {
        const res = await fetch(`/api${endpoint}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    }
};
