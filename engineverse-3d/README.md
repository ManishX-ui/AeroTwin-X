# EngineVerse 3D — Interactive Engine Explorer & Mechanical Learning Simulator

![EngineVerse 3D](https://img.shields.io/badge/Three.js-R3F-0284c7?style=for-the-badge&logo=threedotjs)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=for-the-badge&logo=tailwindcss)

**EngineVerse 3D** is a full-featured, browser-based 3D mechanical engineering visualization and educational laboratory. It enables engineering students, mechanics, aerospace/automotive specialists, and enthusiasts to explore an internal combustion engine in genuine 3D, inspect individual components, understand mechanical assembly kinematics, observe four-stroke cycle operations, and take interactive knowledge checks.

---

## 🌟 Key Features

1. **Genuine 3D Engine Laboratory**:
   - 360-degree free orbit rotation, smooth zoom, pan, and perspective/orthographic views.
   - Studio three-point lighting, metallic shaders, soft ground reference grid, and component highlights.
   - Six camera presets: **Isometric**, **Front**, **Rear**, **Left**, **Right**, and **Top**.

2. **Discrete Component Selection & Inspection**:
   - Direct raycasted pointer selection on 3D geometry or through the searchable hierarchical tree.
   - Dynamic 3D annotations with leader lines (toggleable: *Selected Only*, *All Parts*, *None*).
   - Component isolation mode (isolate any part or group, hiding or restoring the assembly).
   - Visual inspection modes: **Solid Shaded**, **Ghost Block (Transparent)**, and **CAD Wireframe**.

3. **Controlled Exploded Assembly View**:
   - Smooth 0% to 100% explosion slider that moves cylinder head, valves, pistons, manifolds, sump, and accessories along engineered trajectory vectors while preserving part selection.

4. **Realistic Slider-Crank Kinematics & 4-Stroke Cycle Simulator**:
   - Mathematically synchronized slider-crank kinematics ($r=0.28$, $L=0.75$) with flat-plane 180° crank throws (Cylinders 1 & 4 at TDC, Cylinders 2 & 3 at BDC).
   - Standard inline-4 firing order: **1 - 3 - 4 - 2** with 720° crankshaft cycle timeline scrubber.
   - Interactive stroke indicators (**Intake**, **Compression**, **Power**, **Exhaust**) with real-time piston direction and valve lift states.
   - Dynamic plasma spark/fireball illumination during the power stroke.

5. **Comprehensive Component Knowledge Base (22 Components)**:
   - Covers: Engine Block, Cylinder Head, Cylinders 1-4, Pistons 1-4, Connecting Rods 1-4, Crankshaft, Camshaft, Intake Valves, Exhaust Valves, Spark Plugs, Fuel Injectors, Combustion Zone, Cooling Fan, Alternator, Oil Filter, Intake Manifold, Exhaust Manifold (4-into-1), Flywheel with Ring Gear, Oil Sump, and Timing Belt/Pulleys.
   - Detailed specifications: Primary function, working principle, material specs, operating temperatures, machining tolerances, cycle roles, engineering insights, and common failure symptoms.
   - Clickable related-component navigation.

6. **Interactive Guided Learning Tour (11 Lessons)**:
   - Step-by-step curriculum with automated 3D camera focusing, target component highlighting, key mechanical principles, and technical trivia.

7. **Mechanical Engineering Knowledge Quiz (10 Questions)**:
   - Interactive multiple-choice questions testing engine timing, thermodynamic cycles, component identification, and failure modes with instantaneous feedback and technical explanations.

8. **Diagnostic Model Inspector**:
   - Development & QA console reporting mesh node hierarchies, triangle counts, and materials.
   - Live drag-and-drop file picker to test and inspect any external `.glb` / `.gltf` model.

---

## 🛠️ Technology Stack

- **Frontend Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Lucide React icons
- **3D Graphics & Rendering**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **State Management**: Zustand
- **Deployment**: Zero-dependency static build ready for Vercel, Netlify, or GitHub Pages

---

## 📂 Project Structure

```
EngineVerse-3D/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   └── models/
│       └── engine.glb          # Optional custom external GLB asset
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   └── engine.ts           # Domain types & interfaces
│   ├── data/
│   │   ├── engineComponents.ts # 22-component educational database
│   │   ├── learningSteps.ts    # 11-step guided learning curriculum
│   │   └── quizQuestions.ts    # 10-question mechanical quiz
│   ├── store/
│   │   └── useEngineStore.ts   # Global Zustand state store
│   └── components/
│       ├── layout/
│       │   ├── Header.tsx      # Top bar with tabs & actions
│       │   └── Toolbar.tsx     # Bottom kinematics & view toolbar
│       ├── engine/
│       │   ├── EngineCanvas.tsx      # R3F canvas with lighting & controls
│       │   ├── ProceduralEngine.tsx  # Exact kinematic 3D procedural engine
│       │   ├── GLBModelLoader.tsx    # GLB loader with node discovery
│       │   └── ComponentLabels.tsx   # 3D HTML labels & leader anchors
│       └── panels/
│           ├── ComponentExplorer.tsx # Searchable component hierarchy
│           ├── ComponentInfoPanel.tsx# Detailed engineering spec drawer
│           ├── OperationPanel.tsx    # 4-stroke cycle timeline simulator
│           ├── LearningPanel.tsx     # Guided lesson tour
│           ├── QuizPanel.tsx         # Interactive quiz with scoring
│           ├── DiagnosticsModal.tsx  # Model node inspector & GLB test
│           └── HelpModal.tsx         # Navigation & shortcuts guide
```

---

## 🚀 Installation & Local Development

### Prerequisites
- Node.js (v18+ recommended, v20+ / v24 tested)
- npm or yarn or pnpm

### Setup
```bash
# Navigate to project directory
cd EngineVerse-3D

# Install dependencies
npm install

# Start development server
npm run dev
```
Open your browser to `http://127.0.0.1:5173/`.

### Production Build
```bash
# Compile and bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🏎️ External 3D GLB Model Integration Guide

EngineVerse 3D includes a default high-fidelity procedural 3D cutaway engine model with full kinematics. If you wish to plug in an external artist-authored GLB model (e.g. from Blender or CAD):

1. **Asset Placement**:
   Place your binary GLB file at `public/models/engine.glb`.
2. **Mesh Naming Convention**:
   In your 3D modeling tool (Blender, Maya, SolidWorks), name your objects with descriptive IDs matching the registry:
   - `mesh_engine_block`
   - `mesh_cylinder_head`
   - `mesh_piston_1` to `mesh_piston_4`
   - `mesh_connecting_rod_1` to `mesh_connecting_rod_4`
   - `mesh_crankshaft`
   - `mesh_camshaft`
   - `mesh_intake_valve_1` .. `mesh_exhaust_valve_1`
   - `mesh_spark_plug_1`
   - `mesh_fuel_injector`
   - `mesh_cooling_fan`
   - `mesh_alternator`
   - `mesh_oil_filter`
   - `mesh_intake_manifold`
   - `mesh_exhaust_manifold`
   - `mesh_flywheel`
   - `mesh_oil_sump`
3. **Pivots & Coordinates**:
   Ensure origins of rotating components (crankshaft, camshaft, fan) are centered along their rotational axes.
4. **Testing in Diagnostics Mode**:
   Open the application, click the **Model Inspector** tab or file icon in the header, and upload your `.glb` file directly to test mesh hierarchy and node mapping.

---

## ⌨️ Keyboard & Mouse Controls

- **Orbit 360°**: Left-Click and drag (or single-finger drag on touchscreens)
- **Pan**: Right-Click and drag or `Shift` + Left-Click (or two-finger drag)
- **Zoom**: Mouse scroll wheel (or pinch-to-zoom on touchscreens)
- **Select Component**: Left-Click directly on any 3D part or annotation label
- **`Spacebar`**: Play / Pause mechanical animation
- **`Left` / `Right` Arrow Keys**: Step crankshaft angle backward/forward by 15°
- **`H`**: Reset camera to default isometric view
- **`Esc`**: Clear current component selection

---

## 🌐 Deployment to Vercel

This repository is optimized for static deployment on Vercel:

1. Push the `EngineVerse-3D` repository to GitHub.
2. Log in to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Select the repository.
4. Framework Preset: **Vite**.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Click **Deploy**.

---

## 📄 License
MIT License. Developed for advanced aerospace and mechanical engineering digital education.
