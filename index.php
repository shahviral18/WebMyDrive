<?php
// index.php - Homepage - Final Clean Version
// Last updated: 2025-10-10 10:10 AM IST
// Changes: Removed Zoho CSS (controlled by Zoho), fixed footer email link
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO Meta Tags -->
    <title>WebMyDrive for Business | Professional Email & Collaboration Tools</title>
    <meta name="description" content="Get Google Workspace for your business with professional Gmail, Drive storage, Meet video conferencing & more. Expert support included.">
    <meta name="keywords" content="Google Workspace, Gmail business email, Google Drive, Google Meet, business collaboration, professional email, cloud storage, video conferencing">
    <meta name="author" content="WebMyDrive">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://webmydrive.com">
    
    <!-- Open Graph Meta Tags for Social Media -->
    <meta property="og:title" content="Google Workspace for Business | Professional Email & Collaboration">
    <meta property="og:description" content="Transform your business with Google Workspace. Professional Gmail, unlimited storage, video conferencing & more.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://webmydrive.com">
    <meta property="og:image" content="https://webmydrive.com/src/logo.png">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="src/logo.png">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Tailwind Configuration -->
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'brand-primary': '#1bb2e2',
                        'brand-secondary': '#fba02f',
                        'google-blue': '#4285f4',
                        'google-red': '#ea4335',
                        'google-yellow': '#fbbc04',
                        'google-green': '#34a853'
                    },
                    fontFamily: {
                        'sans': ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>

<body class="font-sans antialiased">
    
    <!-- Header / Navigation -->
    <header class="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <nav class="container mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
                <!-- Logo -->
                <div class="flex items-center space-x-3">
                    <img src="src/logo.png" alt="WebMyDrive Logo" class="h-10 w-auto">
                    <span class="text-2xl font-bold text-brand-primary">WebMyDrive</span>
                </div>
                
                <!-- Desktop Navigation -->
                <div class="hidden md:flex items-center space-x-8">
                    <a href="#features" class="text-gray-700 hover:text-brand-primary transition font-medium">Features</a>
                    <a href="#plans" class="text-gray-700 hover:text-brand-primary transition font-medium">Pricing</a>
                    <a href="#faq" class="text-gray-700 hover:text-brand-primary transition font-medium">FAQ</a>
                    <a href="#contact" class="text-gray-700 hover:text-brand-primary transition font-medium">Contact</a>
                    <a href="#plans" class="bg-brand-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition font-semibold">
                        Subscribe Now
                    </a>
                </div>
                
                <!-- Mobile Menu Button -->
                <button id="mobile-menu-btn" class="md:hidden text-gray-700 hover:text-brand-primary focus:outline-none">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </button>
            </div>
            
            <!-- Mobile Navigation Menu -->
            <div id="mobile-menu" class="hidden md:hidden mt-4 pb-4 space-y-3">
                <a href="#features" class="block text-gray-700 hover:text-brand-primary transition font-medium py-2">Features</a>
                <a href="#plans" class="block text-gray-700 hover:text-brand-primary transition font-medium py-2">Pricing</a>
                <a href="#faq" class="block text-gray-700 hover:text-brand-primary transition font-medium py-2">FAQ</a>
                <a href="#contact" class="block text-gray-700 hover:text-brand-primary transition font-medium py-2">Contact</a>
                <a href="#plans" class="block bg-brand-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition font-semibold text-center">
                    Subscribe Now
                </a>
            </div>
        </nav>
    </header>
    
    <!-- Hero Section -->
    <section class="pt-24 pb-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div class="container mx-auto px-4">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                    Secured Storage, Email & Collaboration Tools for Your Business
                </h1>
                <p class="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed">
                    Storage, Email, collaboration, and security—powered by Google, supported by us.
                </p>
                
                <!-- Single CTA Button -->
                <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <a href="#plans" class="bg-brand-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-600 transition shadow-lg hover:shadow-xl transform hover:scale-105">
                        View Plans & Pricing
                    </a>
                    <a href="account_activate.php" class="bg-white text-brand-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition border-2 border-brand-primary">
                        Already Purchased? Activate Now
                    </a>
                </div>
                
                <!-- Trust Badges -->
                <div class="mt-12 flex flex-wrap justify-center items-center gap-8 text-gray-600">
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <span class="font-medium">Powered by Google</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <span class="font-medium">Instant Activation</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <span class="font-medium">Expert Support</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Features Section -->
    <section id="features" class="py-20 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                    Professional tools powered by Google's trusted infrastructure
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Get everything your business needs to succeed in one integrated platform
                </p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Feature 1: Professional Email -->
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
                    <div class="w-14 h-14 bg-google-blue rounded-full flex items-center justify-center mb-6">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">Secured Email with WebMyDrive</h3>
                    <p class="text-gray-700 leading-relaxed">Secured EMail with Google Infrastructure</p>
                </div>
                
                <!-- Feature 2: Cloud Storage -->
                <div class="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
                    <div class="w-14 h-14 bg-google-green rounded-full flex items-center justify-center mb-6">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"/>
                            <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"/>
                            <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">Secure Cloud Storage</h3>
                    <p class="text-gray-700 leading-relaxed">Secure cloud storage with advanced sharing controls</p>
                </div>
                
                <!-- Feature 3: Video Conferencing -->
                <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
                    <div class="w-14 h-14 bg-google-yellow rounded-full flex items-center justify-center mb-6">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">HD Video Conferencing</h3>
                    <p class="text-gray-700 leading-relaxed">HD video conferencing for up to 100 participants</p>
                </div>
                
                <!-- Feature 4: Collaboration -->
                <div class="bg-gradient-to-br from-red-50 to-red-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
                    <div class="w-14 h-14 bg-google-red rounded-full flex items-center justify-center mb-6">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">Real-Time Collaboration</h3>
                    <p class="text-gray-700 leading-relaxed">Real-time collaboration on documents and presentations</p>
                </div>
                
                <!-- Feature 5: Security -->
                <div class="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
                    <div class="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center mb-6">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">Enterprise-Grade Security</h3>
                    <p class="text-gray-700 leading-relaxed">Enterprise-grade security and admin controls</p>
                </div>
                
                <!-- Feature 6: Support -->
                <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
                    <div class="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center mb-6">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.241 1.929-.668 2.754l-1.524-1.525a3.997 3.997 0 00.078-2.183l1.562-1.562C15.802 8.249 16 9.1 16 10zm-5.165 3.913l1.58 1.58A5.98 5.98 0 0110 16a5.976 5.976 0 01-2.516-.552l1.562-1.562a4.006 4.006 0 001.789.027zm-4.677-2.796a4.002 4.002 0 01-.041-2.08l-.08.08-1.53-1.533A5.98 5.98 0 004 10c0 .954.223 1.856.619 2.657l1.54-1.54zm1.088-6.45A5.974 5.974 0 0110 4c.954 0 1.856.223 2.657.619l-1.54 1.54a4.002 4.002 0 00-2.346.033L7.246 4.668zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">Next Business Day Support</h3>
                    <p class="text-gray-700 leading-relaxed">Dedicated support from our expert team</p>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Pricing Plans Section with Zoho Widget -->
    <section id="plans" class="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                    Flexible pricing for businesses of all sizes
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Choose the plan that fits your needs. Instant activation after payment.
                </p>
            </div>
            
            <!-- Zoho Pricing Widget -->
            <div class="max-w-7xl mx-auto">
                <div 
                    id="zf-widget-root-id-h8fbwdozc"
                    data-pricing-table="true"
                    data-digest="2-304b7177c52a20a87fd551fc02076485e57b5a9b5ed1d292eaeef2db80dca05c2baba6bb4aa4acaab737c2b253195bdfb7e2611b3a96075080cb4b717ac2781b" 
                    data-product_url="https://billing.zoho.in">
                </div>
                <script src="https://js.zohostatic.com/books/zfwidgets/assets/js/zf-widget.js"></script>
            </div>
            
            <div class="text-center mt-12">
                <p class="text-lg text-gray-600 mb-6">Ready to get started with Google Workspace?</p>
                <p class="text-gray-600">Choose a plan above to subscribe and activate your account</p>
                <p class="mt-4">
                    <a href="account_activate.php" class="text-brand-primary hover:underline font-semibold text-lg">
                        Already purchased, click here to Activate the account
                    </a>
                </p>
            </div>
        </div>
    </section>
    
    <!-- FAQ Section -->
    <section id="faq" class="py-20 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                    Everything you need to know about our Google Workspace service
                </h2>
            </div>
            
            <div class="max-w-4xl mx-auto space-y-6">
                <!-- FAQ 1 -->
                <div class="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition">
                    <h3 class="text-xl font-bold text-gray-900 mb-3">Is this the real Google Workspace?</h3>
                    <p class="text-gray-700 leading-relaxed">Yes. You still get the same secure Google infrastructure. Your data stays on Google's servers. We are only billing and support partners.</p>
                </div>
                
                <!-- FAQ 2 -->
                <div class="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition">
                    <h3 class="text-xl font-bold text-gray-900 mb-3">Do I get all Google Workspace features?</h3>
                    <p class="text-gray-700 leading-relaxed">Yes, you get 100% of Google Workspace features including Gmail, Drive, Meet, Docs, Sheets, Calendar, etc.</p>
                </div>
                
                <!-- FAQ 3 -->
                <div class="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition">
                    <h3 class="text-xl font-bold text-gray-900 mb-3">How does billing work?</h3>
                    <p class="text-gray-700 leading-relaxed">You will be billed through our Zoho Billing system. Secure payment processing with instant activation upon successful payment.</p>
                </div>
                
                <!-- FAQ 4 -->
                <div class="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition">
                    <h3 class="text-xl font-bold text-gray-900 mb-3">What happens if I cancel?</h3>
                    <p class="text-gray-700 leading-relaxed">If you cancel, your account will be suspended, and permanently removed after 60 days. You can reactivate anytime during this period.</p>
                </div>
                
                <!-- FAQ 5 -->
                <div class="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition">
                    <h3 class="text-xl font-bold text-gray-900 mb-3">Can I migrate my existing emails?</h3>
                    <p class="text-gray-700 leading-relaxed">Yes, we offer migration support for emails, contacts, and calendar data.</p>
                </div>
                
                <!-- FAQ 6 -->
                <div class="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition">
                    <h3 class="text-xl font-bold text-gray-900 mb-3">Is my data safe?</h3>
                    <p class="text-gray-700 leading-relaxed">Absolutely. Your email is still handled by Google's secure systems. The only difference is billing and management are supported by us.</p>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Contact Section -->
    <section id="contact" class="py-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div class="container mx-auto px-4">
            <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-12">
                <div class="text-center mb-12">
                    <h2 class="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                        Need help? Our team is available to onboard you and answer your queries.
                    </h2>
                </div>
                
                <div class="grid md:grid-cols-2 gap-8">
                    <!-- Email -->
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-900 mb-2">Email</h3>
                            <a href="mailto:support@technodoc.in" class="text-brand-primary hover:underline text-lg">support@technodoc.in</a>
                        </div>
                    </div>
                    
                    <!-- Phone -->
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-900 mb-2">Phone</h3>
                            <a href="tel:+919825027360" class="text-brand-primary hover:underline text-lg">+91-9825027360</a>
                        </div>
                    </div>
                </div>
                
                <!-- Business Hours -->
                <div class="mt-8 pt-8 border-t border-gray-200 text-center">
                    <h3 class="text-xl font-bold text-gray-900 mb-4">Business Hours</h3>
                    <div class="space-y-2 text-gray-700">
                        <p><strong>Monday - Friday:</strong> 9:30 AM - 6:30 PM</p>
                        <p><strong>Saturday & Sunday:</strong> Closed</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-12">
        <div class="container mx-auto px-4">
            <div class="grid md:grid-cols-3 gap-8 mb-8">
                <!-- Company Info -->
                <div>
                    <div class="flex items-center space-x-3 mb-4">
                        <img src="src/logo.png" alt="WebMyDrive Logo" class="h-8 w-auto">
                        <span class="text-xl font-bold">WebMyDrive</span>
                    </div>
                    <p class="text-gray-400 leading-relaxed">
                        Professional Google Workspace solutions for businesses of all sizes. Powered by Google, supported by us.
                    </p>
                </div>
                
                <!-- Quick Links -->
                <div>
                    <h3 class="text-lg font-bold mb-4">Quick Links</h3>
                    <ul class="space-y-2">
                        <li><a href="#features" class="text-gray-400 hover:text-white transition">Features</a></li>
                        <li><a href="#plans" class="text-gray-400 hover:text-white transition">Pricing</a></li>
                        <li><a href="#faq" class="text-gray-400 hover:text-white transition">FAQ</a></li>
                        <li><a href="#contact" class="text-gray-400 hover:text-white transition">Contact</a></li>
                        <li><a href="account_activate.php" class="text-gray-400 hover:text-white transition">Already Purchased? Activate</a></li>
                    </ul>
                </div>
                
                <!-- Contact -->
                <div>
                    <h3 class="text-lg font-bold mb-4">Contact Us</h3>
                    <ul class="space-y-2 text-gray-400">
                        <li>
                            <a href="mailto:support@technodoc.in" class="hover:text-white transition">
                                support@technodoc.in
                            </a>
                        </li>
                        <li>
                            <a href="tel:+919825027360" class="hover:text-white transition">
                                +91-9825027360
                            </a>
                        </li>
                        <li>Mon-Fri: 9:30 AM - 6:30 PM</li>
                        <li>Sat-Sun: Closed</li>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-gray-800 pt-8 text-center text-gray-400">
                <p>&copy; <?= date('Y') ?> WebMyDrive. All rights reserved. Powered by Google Workspace.</p>
            </div>
        </div>
    </footer>
    
    <!-- JavaScript -->
    <script>
        // Mobile Menu Toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Close mobile menu when clicking a link
        document.querySelectorAll('#mobile-menu a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Header scroll effect
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const header = document.querySelector('header');
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 100) {
                header.classList.add('shadow-lg');
            } else {
                header.classList.remove('shadow-lg');
            }
            
            lastScroll = currentScroll;
        });
    </script>
</body>
</html>
