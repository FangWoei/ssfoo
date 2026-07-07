# Ladybird Marketing — Setup Guide

## 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → **Create Project**
2. Add a **Web App** → copy the config
3. Enable these services:
   - **Authentication** → Email/Password + Google
   - **Firestore Database** → Start in test mode (then deploy rules)
   - **Storage** → Default bucket

## 2. Environment Variables

```bash
cp .env.example .env
```

Fill in your Firebase values in `.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Install & Run

```bash
npm install
npm run dev
```

## 4. Create First Admin User

1. Register a normal account at `/register`
2. Verify your email
3. In Firebase Console → Firestore → `users` collection
4. Find your user document → edit `role` field → change `"user"` to `"admin"`
5. Refresh the app — you'll see Admin Panel in the navbar

## 5. Deploy Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy --only firestore:rules,storage:rules
```

## 6. Add Products

Go to `/admin/products/new` and start adding products with variants.

---

## Project Structure

```
src/
├── firebase/         # Firebase helpers (auth, products, orders)
├── context/          # AuthContext, cartStore (Zustand)
├── components/
│   ├── layout/       # Navbar, Footer, Layout
│   ├── common/       # ProtectedRoute, LoadingSpinner
│   └── shop/         # ProductCard
├── pages/
│   ├── auth/         # Login, Register, VerifyEmail, ForgotPassword
│   ├── shop/         # Shop, Product, Cart, Checkout, OrderSuccess
│   ├── user/         # Account, Orders, OrderDetail, Wishlist
│   └── admin/        # Dashboard, Products, Orders, Users, Categories
└── utils/            # formatPrice, helpers
```

## Pages Overview

| URL                 | Access         | Description                       |
| ------------------- | -------------- | --------------------------------- |
| `/`                 | Public         | Home page                         |
| `/about`            | Public         | About us                          |
| `/contact`          | Public         | Contact form                      |
| `/login`            | Guest only     | Login                             |
| `/register`         | Guest only     | Register                          |
| `/verify-email`     | Auth           | Email verification                |
| `/shop`             | Login required | Product listing                   |
| `/shop/:id`         | Login required | Product detail + variant selector |
| `/cart`             | Login required | Shopping cart                     |
| `/checkout`         | Login required | Multi-step checkout               |
| `/orders`           | Login required | Order history                     |
| `/account`          | Login required | Profile + address book            |
| `/admin`            | Admin only     | Dashboard                         |
| `/admin/products`   | Admin only     | Product management                |
| `/admin/orders`     | Admin only     | Order management                  |
| `/admin/users`      | Admin only     | User management                   |
| `/admin/categories` | Admin only     | Category management               |
