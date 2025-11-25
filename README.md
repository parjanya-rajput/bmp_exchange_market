# MyBackpack Exchange Frontend

A real-time cryptocurrency exchange frontend built with **Next.js**, **TypeScript**, **WebSockets**, and **Lightweight Charts**, inspired by modern trading platforms like Binance and Backpack.

🚀 **Live Website**: [https://mybackpack-gold.vercel.app/](https://mybackpack-gold.vercel.app/)

---

## 📸 Features

- 📊 Real-time candlestick chart (Kline data)
- 📈 Live order book (bids & asks)
- 🔄 Live trades feed with dynamic coloring
- 💱 Buy/Sell UI (Swap interface)
- 📡 WebSocket-based data updates
- 🌐 Fully responsive Tailwind CSS layout
- 🔐 Firebase Authentication (Email/Password)
- 👤 User Profiles with Portfolio Management
- 💰 Wallet Balance Management

---

## 🛠️ Tech Stack

- [Next.js 15](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [Axios](https://axios-http.com/)
- [Firebase](https://firebase.google.com/) (Authentication & Firestore)
- WebSocket integration via Backpack Exchange

---

## 🧩 Project Structure

app/
├── components/ # All UI components like Chart, OrderBook, Trades, MarketBar
├── contexts/ # AuthContext for Firebase authentication
├── utils/ # ChartManager, ConnectionManager, Firebase config, type definitions
├── api/klines/route.ts # Server-side proxy for fetching kline data
├── auth/ # Login and signup page
├── profile/ # User profile, portfolio, and wallet management
public/ # Static assets
styles/ # Global styles

---

## 📦 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/mybackpack-frontend.git
   cd mybackpack-frontend

2. **Install dependencies**
   ```bash
   npm install

3. **Set up Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password method)
   - Create a Firestore database
   - Copy your Firebase config values
   - Create a `.env.local` file in the root directory:
     ```env
     NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
     ```

4. **Run locally**
   ```bash
   npm run dev

4. **Build for production**
   ```bash
   npm run build
   npm start

## 🌐 Deployment
This project is deployed on Vercel:

🔗 Production URL: https://mybackpack-gold.vercel.app/

## CORS Note
The /api/v1/klines endpoint on Backpack Exchange has CORS restrictions. This project uses a server-side route (/api/klines) in Next.js to safely proxy requests.

## 🔐 Authentication & User Features

- **Login/Signup**: Email and password authentication via Firebase
- **User Profile**: Users can create and manage their profile with name and contact details
- **Portfolio Management**: Track cryptocurrency holdings with:
  - Currency name
  - Quantity held
  - Purchase price
  - Current price
  - Profit & Loss calculations
- **Wallet Balance**: Dummy wallet system with ability to add funds

## ⚠️ Known Limitations
The Swap UI is for demonstration only and does not perform real trades.

Wallet balance is a dummy implementation for demonstration purposes.