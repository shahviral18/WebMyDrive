import axios from "axios";

const API_URL = "http://localhost:3000/api/auth";

async function testAuth() {
    try {
        console.log("Registering user...");
        const regRes = await axios.post(`${API_URL}/register`, {
            email: "admin@webmydrive.com",
            password: "password123",
            referralCode: "ADMIN01"
        });
        console.log("Registration Success:", regRes.data);

        const token = regRes.data.token;

        console.log("Logging in...");
        const loginRes = await axios.post(`${API_URL}/login`, {
            email: "admin@webmydrive.com",
            password: "password123"
        });
        console.log("Login Success:", loginRes.data);

        console.log("Checking Me...");
        const meRes = await axios.get(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Me Success:", meRes.data);

    } catch (error: any) {
        console.error("Test Failed:", error.response ? error.response.data : error.message);
    }
}

testAuth();
