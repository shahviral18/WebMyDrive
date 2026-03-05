/**
 * Environment and API configuration
 * Adjust these URLs based on your deployment environment
 */

export const API_CONFIG = {
  // Admin Console Backend
  ADMIN_API_URL: import.meta.env.VITE_ADMIN_API_URL || "http://localhost:4000",
  
  // Cloud-Plan-Manager (WebMyDrive Main Website)
  CLOUD_PLAN_MANAGER_URL: import.meta.env.VITE_CLOUD_PLAN_MANAGER_URL || "http://localhost:5000",
  
  // Redirect destination after successful plan purchase
  PURCHASE_SUCCESS_REDIRECT: import.meta.env.VITE_PURCHASE_SUCCESS_REDIRECT || "http://localhost:5000/login",
};

export default API_CONFIG;
