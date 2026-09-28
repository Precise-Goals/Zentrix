# Zentrix Sitemap & SEO Guide

## Sitemap Structure
Zentrix is built with strict routing, differentiating public pages and protected user-authenticated views. 

### Public Routes (Unauthenticated)
- **`/` (Home)**
  - 3D Hero, interactive sections, call to action.
- **`/pricing`**
  - ZentrixPass NFT pricing, tiers (Scout, Builder, Architect).
- **`/about`**
  - Architecture diagram, Network params, Contracts, Team.

### Protected Routes (Authenticated via Firebase & BridgeKey)
- **`/onboarding`**
  - Mandatory flow for new users. Captures Role, Bio, Profile, and requires BridgeKey connection.
- **`/marketplace`**
  - Escrow-backed gigs. Freelancers apply, Clients review and lock funds.
- **`/dashboard`**
  - Live milestone tracking. Approvals, invariant withdrawals, and ZentrixPass Tier details.
- **`/profile`**
  - User settings, Active Role toggle, and Web3 assets summary.
- **`/agent`**
  - Sarvam 30B powered AI Chatbot for matchmaking, providing gig cards based on NFT rate limits.

### Support Category (Navbar Dropdown - Protected)
- **`/contact`** (Contact Us)
  - Firebase RTDB backed form.
- **`/legal`** (Legal Disclosures)
  - Terms of Service, Escrow Liability, Data Privacy.
- **`/manual`** (User Manual)
  - Comprehensive guide for freelancers and clients using MST Escrow.

---

## SEO Configuration Strategy

Zentrix is primarily a single-page application (React/Vite). To ensure proper SEO indexing, we implement the following:

### 1. Meta Tags (Index.html / Helmet)
- **Title**: `Zentrix | Escrow-Backed Web3 Freelance Marketplace on MST`
- **Description**: `Join Zentrix, the premier on-chain freelance marketplace. Secure your gigs with smart contract escrow on the MST Blockchain and find the best Web3 talent using Sarvam AI.`
- **Keywords**: `Web3 Freelance, MST Blockchain, Smart Contract Escrow, Crypto Gigs, Web3 Developer Jobs, ZentrixPass, Sarvam AI`

### 2. Open Graph (Social Sharing)
- **og:title**: Zentrix Escrow Marketplace
- **og:description**: Secure freelance contracts on MST Testnet.
- **og:image**: `https://zentrix.vercel.app/og-image.png`
- **og:type**: `website`
- **twitter:card**: `summary_large_image`

### 3. SEO for Dynamic Routes
Since authenticated routes (`/marketplace`, `/dashboard`) cannot be crawled by traditional bots, the SEO footprint relies entirely on the public landing page (`/`), the `/about` page, and the `/pricing` page. 
- Ensure semantic HTML (`<header>`, `<main>`, `<section>`, `<footer>`) is heavily utilized in `Home.tsx`, `About.tsx`, and `Pricing.tsx`.
- Use high-quality accessible contrast for texts.
- Include an `alt` tag for all images (especially `/Robot.png`).

### 4. robots.txt
```txt
User-agent: *
Allow: /
Allow: /pricing
Allow: /about

Disallow: /dashboard
Disallow: /marketplace
Disallow: /profile
Disallow: /onboarding
Disallow: /agent
```

### 5. sitemap.xml (Static Generation)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://zentrix.app/</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://zentrix.app/pricing</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://zentrix.app/about</loc>
    <priority>0.8</priority>
  </url>
</urlset>
```
*(Protected pages are intentionally omitted from `sitemap.xml` to prevent crawler errors.)*
