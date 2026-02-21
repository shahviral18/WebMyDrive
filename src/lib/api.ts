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

export const api = {
    async get(endpoint: string) {
        const res = await fetch(`/api${endpoint}`, {
            method: "GET",
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },

    async post(endpoint: string, data: any) {
        const res = await fetch(`/api${endpoint}`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },

    async put(endpoint: string, data: any) {
        const res = await fetch(`/api${endpoint}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },

    async delete(endpoint: string) {
        const res = await fetch(`/api${endpoint}`, {
            method: "DELETE",
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },

    async patch(endpoint: string, data: any) {
        const res = await fetch(`/api${endpoint}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    }
};
