import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useEngineStore } from '../../store/useEngineStore';
import { ProceduralEngine } from './ProceduralEngine';
import { GLBModelLoader } from './GLBModelLoader';
import { ComponentLabels } from './ComponentLabels';

// Camera manager inside Canvas
const CameraManager: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const {
    activeViewPreset,
    cameraResetTrigger,
    focusTarget,
    setSelectedComponentId
  } = useEngineStore();

  // Reset or preset camera positioning
  useEffect(() => {
    let targetPos: [number, number, number] = [3.8, 2.8, 4.2];
    switch (activeViewPreset) {
      case 'FRONT':
        targetPos = [0, 0, 4.8];
        break;
      case 'REAR':
        targetPos = [0, 0, -4.8];
        break;
      case 'LEFT':
        targetPos = [-4.8, 0, 0];
        break;
      case 'RIGHT':
        targetPos = [4.8, 0, 0];
        break;
      case 'TOP':
        targetPos = [0, 5.5, 0.001];
        break;
      case 'ISOMETRIC':
      default:
        targetPos = [3.8, 2.8, 4.2];
        break;
    }

    camera.position.set(...targetPos);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [activeViewPreset, cameraResetTrigger, camera]);

  // Focus on specific target when requested
  useEffect(() => {
    if (focusTarget && controlsRef.current) {
      controlsRef.current.target.set(...focusTarget);
      controlsRef.current.update();
    }
  }, [focusTarget]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={12}
      maxPolarAngle={Math.PI / 2 + 0.3} // Prevent going below floor
    />
  );
};

export const EngineCanvas: React.FC = () => {
  const { modelSource, setSelectedComponentId } = useEngineStore();

  return (
    <div
      className="relative w-full h-full bg-slate-50 overflow-hidden cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => {
        // Deselect if clicking outside
        if (e.target === e.currentTarget) {
          setSelectedComponentId(null);
        }
      }}
    >
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [3.8, 2.8, 4.2], fov: 42, near: 0.1, far: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#f8fafc']} />

        {/* Studio Three-Point Lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={20}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        <directionalLight position={[-5, 4, -4]} intensity={0.6} color="#e0f2fe" />
        <directionalLight position={[0, -4, 0]} intensity={0.2} color="#f1f5f9" />
        <hemisphereLight intensity={0.4} color="#ffffff" groundColor="#cbd5e1" />

        {/* Ground Reference Grid */}
        <Grid
          position={[0, -1.8, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#cbd5e1"
          sectionSize={2.0}
          sectionThickness={1.2}
          sectionColor="#94a3b8"
          fadeDistance={14}
          fadeStrength={1.5}
        />

        {/* Main 3D Engine Model */}
        {modelSource === 'PROCEDURAL' ? (
          <ProceduralEngine />
        ) : (
          <GLBModelLoader />
        )}

        {/* 3D Component Overlay Labels */}
        <ComponentLabels />

        {/* Camera and Navigation Controller */}
        <CameraManager />
      </Canvas>
    </div>
  );
};
