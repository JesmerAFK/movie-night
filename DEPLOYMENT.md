# 🚀 Deployment Guide - Movie Night by JMAFK

Since your app has two parts (Frontend and Backend), you need to deploy them separately or use a platform that supports both.

## 1. Deploy the Backend (Python)
Netlify **cannot** run a Python server. I recommend using **Render.com** (it's free and easy).

1.  Create an account on [Render.com](https://render.com).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repo (or upload your files).
4.  **Settings**:
    *   **Runtime**: `Python`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5.  After it deploys, Render will give you a URL (like `https://jmafk-backend.onrender.com`). **Copy this!**

---

## 2. Deploy the Frontend (Netlify)
Now you can upload the interface.

1.  In your project folder, run:
    ```bash
    npm run build
    ```
    This creates a folder named `dist`.
2.  Go to [Netlify](https://app.netlify.com).
3.  Drag and drop the `dist` folder into the Netlify upload box.
4.  **CRITICAL STEP**: Go to **Site Settings** -> **Environment Variables**.
5.  Add a new variable:
    *   **Key**: `VITE_BACKEND_URL`
    *   **Value**: (The Render URL you copied earlier)
6.  Trigger a redeploy on Netlify.

---

## 3. Allow CORS (Cross-Origin)
On Render (Backend settings), make sure your CORS origins are set up if you get errors. Currently, the backend is set to allow all origins (`*`), so it should work out of the box.

---

### Local Test before Upload
To make sure everything is ready, you can run:
1. `npm run build`
2. `npx vite preview`

If it works locally, it's ready for Netlify!
