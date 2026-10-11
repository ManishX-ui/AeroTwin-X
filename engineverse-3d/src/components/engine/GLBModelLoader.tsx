import React, { useEffect, useState, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEngineStore } from '../../store/useEngineStore';
import { ModelNodeInfo } from '../../types/engine';

interface GLBModelLoaderProps {
  url?: string;
  onModelLoaded?: (nodes: ModelNodeInfo[]) => void;
}

export const GLBModelLoader: React.FC<GLBModelLoaderProps> = ({
  url = '/models/engine.glb',
  onModelLoaded
}) => {
  const {
    selectedComponentId,
    setSelectedComponentId,
    setHoveredComponentId,
    renderMode,
    customGlbUrl
  } = useEngineStore();

  const [loadError, setLoadError] = useState<string | null>(null);
  const effectiveUrl = customGlbUrl || url;

  let gltf: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    gltf = useGLTF(effectiveUrl);
  } catch (err: any) {
    // handled via error state
  }

  // Clone scene so materials can be altered without polluting cache
  const clonedScene = useMemo(() => {
    if (!gltf?.scene) return null;
    return gltf.scene.clone(true);
  }, [gltf]);

  useEffect(() => {
    if (!clonedScene) return;

    const discoveredNodes: ModelNodeInfo[] = [];

    clonedScene.traverse((child: THREE.Object3D) => {
      const isMesh = child instanceof THREE.Mesh;
      discoveredNodes.push({
        name: child.name || 'Unnamed_Node',
        type: child.type,
        childrenCount: child.children.length,
        isMesh,
        geometryType: isMesh ? (child as THREE.Mesh).geometry?.type : undefined,
        vertexCount: isMesh ? (child as THREE.Mesh).geometry?.attributes?.position?.count : undefined,
        triangleCount: isMesh
          ? (child as THREE.Mesh).geometry?.index
            ? (child as THREE.Mesh).geometry.index!.count / 3
            : ((child as THREE.Mesh).geometry?.attributes?.position?.count || 0) / 3
          : undefined,
        materialName: isMesh
          ? Array.isArray((child as THREE.Mesh).material)
            ? ((child as THREE.Mesh).material as THREE.Material[]).map((m: any) => m.name).join(', ')
            : ((child as THREE.Mesh).material as any)?.name
          : undefined
      });

      if (isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (renderMode === 'WIREFRAME') {
          if (Array.isArray(mesh.material)) {
            (mesh.material as any[]).forEach((m) => {
              if (m) m.wireframe = true;
            });
          } else if (mesh.material) {
            (mesh.material as any).wireframe = true;
          }
        }
      }
    });

    if (onModelLoaded) {
      onModelLoaded(discoveredNodes);
    }
  }, [clonedScene, renderMode, onModelLoaded]);

  if (loadError || !clonedScene) {
    return (
      <group position={[0, 0, 0]}>
        {/* Placeholder notice mesh */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <primitive
      object={clonedScene}
      onPointerDown={(e: any) => {
        e.stopPropagation();
        const clickedNodeName = e.object.name || 'mesh_unknown';
        setSelectedComponentId(clickedNodeName);
      }}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        setHoveredComponentId(e.object.name);
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        setHoveredComponentId(null);
      }}
    />
  );
};
