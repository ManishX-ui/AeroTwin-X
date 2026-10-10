# Deploying AeroTwin-X to Vercel

AeroTwin-X is configured for seamless deployment to **Vercel** with zero extra setup. 

When hosted on Vercel:
- **Instant Live Experience**: The application automatically engages the **Autonomous Cyber-Physical Digital Twin Engine** on Vercel's edge network, producing high-fidelity 50 Hz telemetry, AI anomaly detection, physics-residual strips, 3D engine CAD rendering, and interactive fault injection without requiring a self-hosted backend.
- **Hybrid Live Gateway**: You can connect the Vercel-hosted frontend to a live FastAPI backend (running locally via `uvicorn` or hosted on Railway / Render / Fly.io / AWS) at any time simply by clicking the telemetry status badge or setting the `?api=` parameter.

---

## Method 1: Deploy with GitHub Integration (Recommended — 1 Click)

1. **Push your code to GitHub**:
   ```bash
   git push origin main
   ```

2. **Open Vercel**:
   Go to [vercel.com/new](https://vercel.com/new).

3. **Import Repository**:
   - Select your repository: `ManishX-ui/AeroTwin-X`.
   - **Framework Preset**: Leave as `Other` (detected from `vercel.json`).
   - **Root Directory**: `./` (Default).
   - **Build & Output Settings**: Vercel will automatically read `vercel.json` (`outputDirectory: "frontend"`).

4. **Click Deploy**:
   - Vercel will instantly publish the application.
   - Your dashboard will be live at `https://aerotwin-x.vercel.app` (or your assigned Vercel URL).

---

## Method 2: Deploy with Vercel CLI

If you prefer deploying directly from your terminal:

1. **Log in to Vercel** (one-time):
   ```bash
   npx vercel login
   ```
   *(Follow the browser prompt to authorize)*

2. **Deploy to Preview**:
   ```bash
   npx vercel
   ```

3. **Deploy to Production**:
   ```bash
   npx vercel --prod
   ```

---

## Architecture on Vercel

```
                                      +---------------------------------------------+
                                      |             Vercel Edge Network             |
                                      |                                             |
                                      |   - High-Speed Static Delivery (SPA)        |
                                      |   - Clean routing & asset caching           |
                                      |   - Autonomous Client Digital Twin Engine   |
                                      +----------------------+----------------------+
                                                             |
                                      [Optional Live Link]   | (WebSocket / REST)
                                                             v
                                      +---------------------------------------------+
                                      |      FastAPI Backend (Docker/Cloud/Local)   |
                                      |                                             |
                                      |   - 50 Hz Rotax 914 Aero-Piston Simulator   |
                                      |   - scikit-learn / ML Pipeline              |
                                      |   - SQLite / CAN Bus WebSocket Gateway      |
                                      +---------------------------------------------+
```

### Switching to an External Live Backend Gateway
- **In Browser**: Click the **`TELEMETRY: AUTONOMOUS TWIN`** pill in the top header and enter your backend URL:
  ```text
  http://localhost:8000
  ```
  *(or your production server URL: `https://api.yourdomain.com`)*
- **Via URL Parameter**: Append `?api=http://localhost:8000` to your Vercel URL:
  ```text
  https://aerotwin-x.vercel.app/?api=http://localhost:8000
  ```
