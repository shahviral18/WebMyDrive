# Demo Websites Deployment Guide

## Overview

This guide explains how to deploy multiple isolated React/Vite demo
websites to cPanel, ensuring each demo is completely independent with no
cross-contamination.

------------------------------------------------------------------------

## 📋 Prerequisites

### Required Tools:

-   Node.js & npm installed locally
-   FTP/cPanel access credentials
-   cPanel API token (optional, for automation)

### Project Requirements:

-   React + Vite projects
-   Each demo must be in its own directory
-   Source code with `package.json`, `vite.config.ts`, and `src/` folder

------------------------------------------------------------------------

## 🚀 Deployment Process

### Step 1: Prepare the Project

#### 1.1 Configure Vite Base Path

Edit `vite.config.ts` and add the `base` path:

``` typescript
export default defineConfig(({ mode }) => ({
  base: '/projectname/demo/1/',  // Change to /projectname/demo/2/, /projectname/demo/3/, etc. for each demo
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

#### 1.2 Configure React Router Basename

Edit `src/App.tsx` and add the `basename` prop:

``` typescript
<BrowserRouter basename="/projectname/demo/1">  {/* Change to /projectname/demo/2, /projectname/demo/3, etc. for each demo */}
  <Routes>
    <Route path="/" element={<HomePage />} />
    {/* other routes */}
  </Routes>
</BrowserRouter>
```

#### 1.3 Fix Image/Asset Paths

For any images with absolute paths (like logos), use Vite's base URL:

``` typescript
// ❌ Wrong:
<img src="/logo.svg" />

// ✅ Correct:
<img src={`${import.meta.env.BASE_URL}logo.svg`} />
```

------------------------------------------------------------------------

### Step 2: Build the Project

Run the build command:

``` bash
cd /path/to/demo_project
npm install  # If not already installed
npm run build
```

This creates a `dist/` folder with production-ready files.

------------------------------------------------------------------------

### Step 3: Automated Deployment (No Manual cPanel Work!)

All steps are automated using command line tools. **No need to manually
add code in cPanel!**

#### 3.1 Upload Build via cPanel API Token

**Using API Token (Recommended):**

``` bash
cd dist
tar -czf ../demo1-build.tar.gz .
cd ..

# Upload using cPanel API Token
curl -H "Authorization: cpanel wmdtest:JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD" \
  -F "file=@demo1-build.tar.gz" \
  "https://test.webmydrive.com:2083/execute/Fileman/upload_files?dir=/home4/wmdtest"
```

**Backup Method (FTP if API fails):**

``` bash
curl -T demo1-build.tar.gz ftp://test.webmydrive.com/ --user wmdtest:Support_1123
```

**Why API Token?** - More secure than storing FTP passwords - Can be
revoked without changing main password - Better for automation and CI/CD

#### 3.2 Extract Files Automatically

``` bash
curl -s -H "Authorization: cpanel wmdtest:JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD" \
  "https://test.webmydrive.com:2083/json-api/cpanel" \
  --data "cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&op=extract&sourcefiles=demo1-build.tar.gz&destfiles=public_html/demo1"
```

#### 3.3 Create .htaccess Automatically

``` bash
curl -s -H "Authorization: cpanel wmdtest:JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD" \
  -X POST "https://test.webmydrive.com:2083/json-api/cpanel" \
  --data-urlencode 'cpanel_jsonapi_apiversion=2' \
  --data-urlencode 'cpanel_jsonapi_module=Fileman' \
  --data-urlencode 'cpanel_jsonapi_func=savefile' \
  --data-urlencode 'dir=public_html/demo1' \
  --data-urlencode 'filename=.htaccess' \
  --data-urlencode 'content=<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /projectname/demo/1/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /projectname/demo/1/index.html [L]
</IfModule>

DirectoryIndex index.html
Options -Indexes'
```

#### 3.4 Cleanup (Remove tar.gz)

``` bash
curl -s -H "Authorization: cpanel wmdtest:JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD" \
  "https://test.webmydrive.com:2083/json-api/cpanel" \
  --data "cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&op=unlink&sourcefiles=demo1-build.tar.gz"
```

**✅ All done via command line - NO manual cPanel work required!**

------------------------------------------------------------------------

### Step 6: Verify Deployment

Test the following URLs: -
`https://test.webmydrive.com/projectname/demo/1/` - Home page -
`https://test.webmydrive.com/projectname/demo/1/services` - Services
page - `https://test.webmydrive.com/projectname/demo/1/contact` -
Contact page -
`https://test.webmydrive.com/projectname/demo/1/stories` - Client
Stories page

✅ All pages should load without 404 errors ✅ Navigation should work
correctly ✅ No redirects to other demos

------------------------------------------------------------------------

## 📁 Directory Structure on Server

### Complete cPanel File Structure

    /home4/wmdtest/
    └── public_html/
        ├── index.html (Landing page with links to all demos)
        ├── demo1/
        │   ├── index.html
        │   ├── .htaccess
        │   ├── assets/
        │   │   ├── index-[hash].js
        │   │   ├── index-[hash].css
        │   │   └── [image-files]
        │   ├── logo_full.svg
        │   └── vite.svg
        ├── demo2/
        │   ├── index.html
        │   ├── .htaccess
        │   ├── assets/
        │   │   ├── index-[hash].js
        │   │   ├── index-[hash].css
        │   │   └── [image-files]
        │   └── (other static assets)
        ├── demo3/
        │   ├── index.html
        │   ├── .htaccess
        │   ├── assets/
        │   │   ├── index-[hash].js
        │   │   ├── index-[hash].css
        │   │   └── [image-files]
        │   └── (other static assets)
        └── demo4/
            ├── index.html
            ├── .htaccess
            ├── assets/
            │   ├── index-[hash].js
            │   ├── index-[hash].css
            │   └── [image-files]
            └── (other static assets)

### Simplified View

    public_html/
    ├── index.html (Landing page with links to all demos)
    ├── demo1/
    │   ├── index.html
    │   ├── assets/
    │   ├── .htaccess
    │   └── (other built files)
    ├── demo2/
    │   ├── index.html
    │   ├── assets/
    │   ├── .htaccess
    │   └── (other built files)
    ├── demo3/
    │   ├── index.html
    │   ├── assets/
    │   ├── .htaccess
    │   └── (other built files)
    └── demo4/
        ├── index.html
        ├── assets/
        ├── .htaccess
        └── (other built files)

### Key Paths to Remember:

-   **cPanel Home:** `/home4/wmdtest/`
-   **Web Root:** `/home4/wmdtest/public_html/`
-   **Project Name Demo 1:**
    `/home4/wmdtest/public_html/projectname/demo/1/`
-   **Project Name Demo 2:**
    `/home4/wmdtest/public_html/projectname/demo/2/`
-   **Project Name Demo 3:**
    `/home4/wmdtest/public_html/projectname/demo/3/`
-   **Project Name Demo 4:**
    `/home4/wmdtest/public_html/projectname/demo/4/`

------------------------------------------------------------------------

## 🎯 Isolation Checklist

Ensure each demo is completely isolated:

-   [ ] Each demo has its own `base` path in vite.config.ts
-   [ ] Each demo has its own `basename` in React Router
-   [ ] No absolute paths (starting with `/`) for images/assets
-   [ ] Each demo has its own `.htaccess` with correct RewriteBase
-   [ ] Each demo folder contains only its own files
-   [ ] Navigation within each demo stays within that demo

------------------------------------------------------------------------

## 🔄 Quick Deployment Commands

### For Demo 1:

``` bash
cd /c/Projects/Demo_1/Dr-Ilas_Demo_1-main
npm run build
cd dist && tar -czf ../demo1.tar.gz .
curl -T ../demo1.tar.gz ftp://test.webmydrive.com/ --user wmdtest:password
```

### For Demo 2:

``` bash
cd /c/Projects/demo_2/Sample_2
npm run build
cd dist && tar -czf ../demo2.tar.gz .
curl -T ../demo2.tar.gz ftp://test.webmydrive.com/ --user wmdtest:password
```

### For Demo 3:

``` bash
cd /c/Projects/demo_3/Sample_3/app-weaver-main
npm run build
cd dist && tar -czf ../demo3.tar.gz .
curl -T ../demo3.tar.gz ftp://test.webmydrive.com/ --user wmdtest:password
```

### For Demo 4:

``` bash
cd "/c/Projects/demo_4/dr.-ila-s-serene-haven-main (1)/dr.-ila-s-serene-haven-main"
npm run build
cd dist && tar -czf ../demo4.tar.gz .
curl -T ../demo4.tar.gz ftp://test.webmydrive.com/ --user wmdtest:password
```

------------------------------------------------------------------------

## 🌐 Landing Page Setup

Create `public_html/index.html`:

``` html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo Sites</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .demo-link {
            display: block;
            padding: 20px;
            margin: 10px 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Demo Sites</h1>
        <a href="/projectname/demo/1/" class="demo-link">Project Name Demo 1</a>
        <a href="/projectname/demo/2/" class="demo-link">Project Name Demo 2</a>
        <a href="/projectname/demo/3/" class="demo-link">Project Name Demo 3</a>
        <a href="/projectname/demo/4/" class="demo-link">Project Name Demo 4</a>
    </div>
</body>
</html>
```

------------------------------------------------------------------------

## 🐛 Common Issues & Solutions

### Issue 1: 404 Errors on Page Refresh

**Solution:** Ensure `.htaccess` is properly configured with correct
RewriteBase

### Issue 2: Assets Not Loading

**Solution:** Check that `base` path in vite.config.ts matches the
deployment path

### Issue 3: Wrong Demo Loading

**Solution:** Verify `basename` in React Router matches the demo path

### Issue 4: Blank Page

**Solution:** Check browser console for errors, usually asset path
issues

### Issue 5: Logo Not Visible

**Solution:** Use `import.meta.env.BASE_URL` for public assets

------------------------------------------------------------------------

## 📝 Configuration Summary

  ------------------------------------------------------------------------------------------------------------------------------------
  Demo       Project              Base Path                Basename                URL
  ---------- -------------------- ------------------------ ----------------------- ---------------------------------------------------
  Project    `Asset-Manager 3D`   `/projectname/demo/1/`   `/projectname/demo/1`   `https://test.webmydrive.com/projectname/demo/1/`
  Name Demo                                                                        
  1                                                                                

  Project    *(next deployment)*  `/projectname/demo/2/`   `/projectname/demo/2`   `https://test.webmydrive.com/projectname/demo/2/`
  Name Demo                                                                        
  2                                                                                

  Project    *(next deployment)*  `/projectname/demo/3/`   `/projectname/demo/3`   `https://test.webmydrive.com/projectname/demo/3/`
  Name Demo                                                                        
  3                                                                                

  Project    *(next deployment)*  `/projectname/demo/4/`   `/projectname/demo/4`   `https://test.webmydrive.com/projectname/demo/4/`
  Name Demo                                                                        
  4                                                                                
  ------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🔐 cPanel Credentials & API Token Setup

### Current Credentials:

**Domain:** test.webmydrive.com **IP:** 43.225.55.146 **Username:**
wmdtest **Password:** Support_1123 **API Token Name:**
deployment_automation **API Token:** JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD

------------------------------------------------------------------------

### How to Get/Create cPanel API Token:

1.  **Login to cPanel**

    -   Go to: `https://test.webmydrive.com:2083`
    -   Username: `wmdtest`
    -   Password: `Support_1123`

2.  **Navigate to API Tokens**

    -   Search for "API Tokens" in cPanel
    -   Or go to: Security → Manage API Tokens

3.  **Create New Token** (if needed)

    -   Click "Create" button
    -   Enter name: `deployment_automation`
    -   Click "Create"
    -   **COPY THE TOKEN IMMEDIATELY** (shown only once!)

4.  **View Existing Token**

    -   Find your token name in the list
    -   Click "View" or use existing token
    -   Note: Token value is only shown once during creation

5.  **Use in Commands**

    ``` bash
    Authorization: cpanel wmdtest:YOUR_API_TOKEN_HERE
    ```

**Security Best Practices:** - Never commit API tokens to Git - Store in
environment variables - Rotate tokens periodically - Delete unused
tokens

------------------------------------------------------------------------

## ✅ Final Verification

After deploying all demos:

1.  Visit the landing page: `http://test.webmydrive.com/`
2.  Click each demo link and verify it loads
3.  Navigate to different pages within each demo
4.  Verify no 404 errors
5.  Confirm no cross-demo navigation
6.  Test on mobile and desktop browsers

------------------------------------------------------------------------

## 📚 Additional Notes

-   Always test locally before deploying
-   Keep backup of `dist` folders
-   Document any custom configurations
-   Update this guide if deployment process changes
-   Consider automating the process with CI/CD

------------------------------------------------------------------------

**Last Updated:** March 5, 2026 **Deployed By:** Antigravity AI
Assistant **Production URL:**
https://test.webmydrive.com/projectname/demo/1/ **Status:** ✅ URL
Structure Updated --- New Path: /projectname/demo/1/
