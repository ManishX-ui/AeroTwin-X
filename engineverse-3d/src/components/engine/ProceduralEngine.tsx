import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineStore } from '../../store/useEngineStore';
import { ENGINE_COMPONENTS } from '../../data/engineComponents';

// Cylinder longitudinal coordinates (Z axis)
const CYLINDER_Z = [1.05, 0.35, -0.35, -1.05];
// Inline-4 flat-plane crank throw phase offsets
const CRANK_PHASES = [0, Math.PI, Math.PI, 0];

const CRANK_RADIUS = 0.28;
const ROD_LENGTH = 0.75;
const CRANK_AXIS_Y = -0.65;

export const ProceduralEngine: React.FC = () => {
  const {
    selectedComponentId,
    hoveredComponentId,
    setSelectedComponentId,
    setHoveredComponentId,
    hiddenComponentIds,
    isolatedComponentId,
    explodedProgress,
    renderMode,
    outerBlockTransparency,
    isPlaying,
    simulationSpeed,
    crankAngle,
    setCrankAngle,
    showSectionPlane,
    sectionPlanePosition
  } = useEngineStore();

  // Animation frame loop
  useFrame((_, delta) => {
    if (isPlaying) {
      // 1.5 revolutions per second at 1.0x speed = 540 deg/s
      const angleDelta = delta * 360 * simulationSpeed;
      setCrankAngle((crankAngle + angleDelta) % 720);
    }
  });

  const crankAngleRad = useMemo(() => (crankAngle * Math.PI) / 180, [crankAngle]);

  // Calculate kinematics for each cylinder
  const pistonStates = useMemo(() => {
    return CYLINDER_Z.map((z, i) => {
      const phase = CRANK_PHASES[i];
      const theta = crankAngleRad + phase;

      // Crankpin coordinates
      const pinX = CRANK_RADIUS * Math.sin(theta);
      const pinY = CRANK_AXIS_Y + CRANK_RADIUS * Math.cos(theta);

      // Piston wristpin coordinates (moves along X=0)
      const pistonY = pinY + Math.sqrt(Math.max(0, ROD_LENGTH * ROD_LENGTH - pinX * pinX));

      // Connecting rod tilt angle
      const rodAngle = Math.asin(-pinX / ROD_LENGTH);

      // Rod center coordinates
      const rodMidX = pinX * 0.5;
      const rodMidY = (pinY + pistonY) * 0.5;

      // Cycle stroke for this cylinder
      const cylDeg = (((crankAngle + (phase * 180) / Math.PI) % 720) + 720) % 720;
      let stroke = 'INTAKE';
      let isFiring = false;
      if (cylDeg < 180) {
        stroke = 'POWER';
        if (cylDeg < 60) isFiring = true;
      } else if (cylDeg < 360) {
        stroke = 'EXHAUST';
      } else if (cylDeg < 540) {
        stroke = 'INTAKE';
      } else {
        stroke = 'COMPRESSION';
      }

      return {
        z,
        pinX,
        pinY,
        pistonY,
        rodAngle,
        rodMidX,
        rodMidY,
        stroke,
        isFiring
      };
    });
  }, [crankAngle, crankAngleRad]);

  // Materials map
  const materials = useMemo(() => {
    const isWireframe = renderMode === 'WIREFRAME';

    return {
      castAluminum: new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        metalness: 0.65,
        roughness: 0.35,
        wireframe: isWireframe
      }),
      blockCutaway: new THREE.MeshStandardMaterial({
        color: '#64748b',
        metalness: 0.5,
        roughness: 0.45,
        transparent: renderMode === 'TRANSPARENT',
        opacity: renderMode === 'TRANSPARENT' ? outerBlockTransparency : 0.95,
        wireframe: isWireframe
      }),
      forgedSteel: new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        metalness: 0.85,
        roughness: 0.2,
        wireframe: isWireframe
      }),
      darkIron: new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.7,
        roughness: 0.5,
        wireframe: isWireframe
      }),
      copperBrass: new THREE.MeshStandardMaterial({
        color: '#d97706',
        metalness: 0.8,
        roughness: 0.3,
        wireframe: isWireframe
      }),
      ceramicWhite: new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        metalness: 0.1,
        roughness: 0.15,
        wireframe: isWireframe
      }),
      plasticNylon: new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.2,
        roughness: 0.6,
        wireframe: isWireframe
      }),
      chromeExhaust: new THREE.MeshStandardMaterial({
        color: '#e2e8f0',
        metalness: 0.9,
        roughness: 0.15,
        wireframe: isWireframe
      }),
      oilFilterBlue: new THREE.MeshStandardMaterial({
        color: '#0284c7',
        metalness: 0.4,
        roughness: 0.3,
        wireframe: isWireframe
      }),
      firePlasma: new THREE.MeshBasicMaterial({
        color: '#f97316',
        transparent: true,
        opacity: 0.85
      })
    };
  }, [renderMode, outerBlockTransparency]);

  // Helper to determine component visibility and styling
  const getComponentStatus = (id: string) => {
    if (hiddenComponentIds.has(id)) return { visible: false, highlighted: false };
    if (isolatedComponentId && isolatedComponentId !== id) {
      return { visible: false, highlighted: false };
    }
    const isSelected = selectedComponentId === id;
    const isHovered = hoveredComponentId === id;
    return {
      visible: true,
      highlighted: isSelected || isHovered,
      isSelected
    };
  };

  // Helper for exploded offset vector
  const getExplosionOffset = (id: string): [number, number, number] => {
    if (explodedProgress <= 0) return [0, 0, 0];
    const comp = ENGINE_COMPONENTS.find((c) => c.id === id);
    if (!comp) return [0, 0, 0];
    const [vx, vy, vz] = comp.explosionVector;
    const distanceMultiplier = 1.25;
    return [
      vx * explodedProgress * distanceMultiplier,
      vy * explodedProgress * distanceMultiplier,
      vz * explodedProgress * distanceMultiplier
    ];
  };

  // Click & pointer handlers
  const handlePointerDown = (e: any, id: string) => {
    e.stopPropagation();
    setSelectedComponentId(id);
  };

  const handlePointerOver = (e: any, id: string) => {
    e.stopPropagation();
    setHoveredComponentId(id);
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredComponentId(null);
  };

  // Render high-efficiency highlight wrapper
  const wrapInteractive = (
    id: string,
    children: React.ReactNode,
    basePos: [number, number, number] = [0, 0, 0]
  ) => {
    const status = getComponentStatus(id);
    if (!status.visible) return null;

    const offset = getExplosionOffset(id);
    const finalPos: [number, number, number] = [
      basePos[0] + offset[0],
      basePos[1] + offset[1],
      basePos[2] + offset[2]
    ];

    return (
      <group
        key={id}
        position={finalPos}
        onPointerDown={(e) => handlePointerDown(e, id)}
        onPointerOver={(e) => handlePointerOver(e, id)}
        onPointerOut={handlePointerOut}
      >
        {children}
        {status.highlighted && (
          <pointLight
            color={status.isSelected ? '#38bdf8' : '#60a5fa'}
            intensity={status.isSelected ? 2.5 : 1.2}
            distance={1.5}
          />
        )}
      </group>
    );
  };

  return (
    <group name="EngineAssemblyRoot">
      {/* ---------------- 1. ENGINE BLOCK ---------------- */}
      {wrapInteractive(
        'engine_block',
        <group>
          {/* Main Crankcase Box Structure with cutaway open sides */}
          <mesh material={materials.blockCutaway} position={[0, -0.4, 0]}>
            <boxGeometry args={[1.5, 1.1, 2.7]} />
          </mesh>
          {/* Main Bearing Webs */}
          {[-1.35, -0.7, 0, 0.7, 1.35].map((zPos, idx) => (
            <mesh
              key={idx}
              material={materials.darkIron}
              position={[0, CRANK_AXIS_Y, zPos]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.26, 0.26, 0.08, 24]} />
            </mesh>
          ))}
        </group>
      )}

      {/* ---------------- 2. CYLINDER HEAD ---------------- */}
      {wrapInteractive(
        'cylinder_head',
        <group>
          <mesh material={materials.castAluminum} position={[0, 0.75, 0]}>
            <boxGeometry args={[1.42, 0.55, 2.65]} />
          </mesh>
          {/* Valve Cover / Cam Cover */}
          <mesh material={materials.darkIron} position={[0, 1.12, 0]}>
            <boxGeometry args={[1.35, 0.22, 2.6]} />
          </mesh>
        </group>
      )}

      {/* ---------------- 3. CYLINDERS ---------------- */}
      {wrapInteractive(
        'cylinder_1',
        <group>
          {CYLINDER_Z.map((z, idx) => (
            <mesh key={idx} material={materials.forgedSteel} position={[0, 0.05, z]}>
              <cylinderGeometry args={[0.34, 0.34, 0.85, 32, 1, true]} />
            </mesh>
          ))}
        </group>
      )}

      {/* ---------------- 4. CRANKSHAFT ---------------- */}
      {wrapInteractive(
        'crankshaft',
        <group position={[0, CRANK_AXIS_Y, 0]} rotation={[0, 0, crankAngleRad]}>
          {/* Main Center Shaft Bar */}
          <mesh material={materials.forgedSteel} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 2.9, 24]} />
          </mesh>
          {/* Counterweights & Crankpins */}
          {CYLINDER_Z.map((z, i) => {
            const phase = CRANK_PHASES[i];
            const px = CRANK_RADIUS * Math.sin(phase);
            const py = CRANK_RADIUS * Math.cos(phase);
            return (
              <group key={i}>
                {/* Crankpin journal */}
                <mesh
                  material={materials.forgedSteel}
                  position={[px, py, z]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.09, 0.09, 0.14, 20]} />
                </mesh>
                {/* Counterweight counter-balance */}
                <mesh
                  material={materials.darkIron}
                  position={[-px * 0.9, -py * 0.9, z]}
                >
                  <boxGeometry args={[0.42, 0.18, 0.08]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ---------------- 5. PISTONS & CONNECTING RODS ---------------- */}
      {pistonStates.map((state, i) => {
        const pistonId = `piston_${i + 1}`;
        const rodId = `connecting_rod_${i + 1}`;

        return (
          <React.Fragment key={i}>
            {/* Piston */}
            {wrapInteractive(
              pistonId,
              <group position={[0, state.pistonY, state.z]}>
                {/* Piston Crown & Skirt */}
                <mesh material={materials.forgedSteel}>
                  <cylinderGeometry args={[0.32, 0.32, 0.38, 32]} />
                </mesh>
                {/* Compression Rings */}
                <mesh material={materials.darkIron} position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.325, 0.325, 0.02, 32]} />
                </mesh>
                <mesh material={materials.darkIron} position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.325, 0.325, 0.02, 32]} />
                </mesh>
                {/* Wrist Pin */}
                <mesh
                  material={materials.darkIron}
                  rotation={[0, 0, Math.PI / 2]}
                  position={[0, -0.05, 0]}
                >
                  <cylinderGeometry args={[0.06, 0.06, 0.5, 16]} />
                </mesh>
              </group>
            )}

            {/* Connecting Rod */}
            {wrapInteractive(
              rodId,
              <group
                position={[state.rodMidX, state.rodMidY, state.z]}
                rotation={[0, 0, state.rodAngle]}
              >
                {/* Rod H-Beam Body */}
                <mesh material={materials.forgedSteel}>
                  <boxGeometry args={[0.07, ROD_LENGTH * 0.85, 0.06]} />
                </mesh>
                {/* Small End (Piston Wristpin) */}
                <mesh
                  material={materials.forgedSteel}
                  position={[0, ROD_LENGTH * 0.45, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.08, 0.08, 0.09, 16]} />
                </mesh>
                {/* Big End (Crankpin Journal) */}
                <mesh
                  material={materials.forgedSteel}
                  position={[0, -ROD_LENGTH * 0.45, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.13, 0.13, 0.1, 20]} />
                </mesh>
              </group>
            )}

            {/* Firing Plasma Glow (combustion effect) */}
            {state.isFiring && (
              <mesh position={[0, 0.42, state.z]}>
                <sphereGeometry args={[0.26, 16, 16]} />
                <primitive object={materials.firePlasma} attach="material" />
                <pointLight color="#f97316" intensity={4} distance={1.2} />
              </mesh>
            )}
          </React.Fragment>
        );
      })}

      {/* ---------------- 6. CAMSHAFT & VALVES ---------------- */}
      {wrapInteractive(
        'camshaft',
        <group position={[0, 1.25, 0]}>
          {/* Intake Camshaft (Port side) */}
          <group position={[-0.25, 0, 0]} rotation={[0, 0, crankAngleRad * 0.5]}>
            <mesh material={materials.forgedSteel} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.7, 16]} />
            </mesh>
            {CYLINDER_Z.map((z, idx) => (
              <mesh
                key={idx}
                material={materials.darkIron}
                position={[0.05, 0.04, z]}
                rotation={[0, 0, (idx * Math.PI) / 2]}
              >
                <boxGeometry args={[0.09, 0.14, 0.06]} />
              </mesh>
            ))}
          </group>

          {/* Exhaust Camshaft (Starboard side) */}
          <group position={[0.25, 0, 0]} rotation={[0, 0, crankAngleRad * 0.5]}>
            <mesh material={materials.forgedSteel} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.7, 16]} />
            </mesh>
            {CYLINDER_Z.map((z, idx) => (
              <mesh
                key={idx}
                material={materials.darkIron}
                position={[0.05, 0.04, z]}
                rotation={[0, 0, (idx * Math.PI) / 2 + Math.PI / 4]}
              >
                <boxGeometry args={[0.09, 0.14, 0.06]} />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* Intake Valves */}
      {wrapInteractive(
        'intake_valve_1',
        <group>
          {CYLINDER_Z.map((z, idx) => {
            const isIntakeStroke = pistonStates[idx]?.stroke === 'INTAKE';
            const valveLift = isIntakeStroke ? -0.08 : 0;
            return (
              <group key={idx} position={[-0.22, 0.85 + valveLift, z]}>
                {/* Stem */}
                <mesh material={materials.forgedSteel}>
                  <cylinderGeometry args={[0.02, 0.02, 0.55, 12]} />
                </mesh>
                {/* Valve Head / Poppet Dish */}
                <mesh material={materials.forgedSteel} position={[0, -0.26, 0]}>
                  <cylinderGeometry args={[0.13, 0.06, 0.04, 20]} />
                </mesh>
                {/* Spring */}
                <mesh material={materials.darkIron} position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.22, 12]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Exhaust Valves */}
      {wrapInteractive(
        'exhaust_valve_1',
        <group>
          {CYLINDER_Z.map((z, idx) => {
            const isExhaustStroke = pistonStates[idx]?.stroke === 'EXHAUST';
            const valveLift = isExhaustStroke ? -0.08 : 0;
            return (
              <group key={idx} position={[0.22, 0.85 + valveLift, z]}>
                <mesh material={materials.chromeExhaust}>
                  <cylinderGeometry args={[0.02, 0.02, 0.55, 12]} />
                </mesh>
                <mesh material={materials.chromeExhaust} position={[0, -0.26, 0]}>
                  <cylinderGeometry args={[0.11, 0.05, 0.04, 20]} />
                </mesh>
                <mesh material={materials.darkIron} position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.22, 12]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ---------------- 7. SPARK PLUGS ---------------- */}
      {wrapInteractive(
        'spark_plug_1',
        <group>
          {CYLINDER_Z.map((z, idx) => (
            <group key={idx} position={[0, 1.35, z]}>
              {/* Ceramic insulator */}
              <mesh material={materials.ceramicWhite} position={[0, 0.14, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.2, 16]} />
              </mesh>
              {/* Hex nut metal shell */}
              <mesh material={materials.forgedSteel} position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.06, 6]} />
              </mesh>
              {/* Threaded electrode base */}
              <mesh material={materials.darkIron} position={[0, -0.06, 0]}>
                <cylinderGeometry args={[0.038, 0.038, 0.1, 16]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ---------------- 8. FUEL INJECTORS & RAIL ---------------- */}
      {wrapInteractive(
        'fuel_injector',
        <group position={[-0.58, 0.9, 0]}>
          {/* Common Rail Tube */}
          <mesh material={materials.copperBrass} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 2.5, 16]} />
          </mesh>
          {/* Individual Injectors */}
          {CYLINDER_Z.map((z, idx) => (
            <group key={idx} position={[0, -0.1, z]} rotation={[0, 0, -Math.PI / 6]}>
              <mesh material={materials.darkIron}>
                <cylinderGeometry args={[0.028, 0.028, 0.18, 12]} />
              </mesh>
              <mesh material={materials.copperBrass} position={[0, -0.1, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.06, 12]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ---------------- 9. INTAKE MANIFOLD ---------------- */}
      {wrapInteractive(
        'intake_manifold',
        <group position={[-0.92, 0.72, 0]}>
          {/* Intake Plenum */}
          <mesh material={materials.plasticNylon} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 2.4, 20]} />
          </mesh>
          {/* Throttle Body entrance */}
          <mesh
            material={materials.castAluminum}
            position={[-0.2, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.12, 0.12, 0.35, 20]} />
          </mesh>
          {/* 4 Curved Runners connecting to Head */}
          {CYLINDER_Z.map((z, idx) => (
            <mesh key={idx} material={materials.plasticNylon} position={[0.22, 0, z]}>
              <boxGeometry args={[0.35, 0.12, 0.16]} />
            </mesh>
          ))}
        </group>
      )}

      {/* ---------------- 10. EXHAUST MANIFOLD (4-INTO-1) ---------------- */}
      {wrapInteractive(
        'exhaust_manifold',
        <group position={[0.92, 0.5, 0]}>
          {/* 4 Header Pipes */}
          {CYLINDER_Z.map((z, idx) => (
            <mesh
              key={idx}
              material={materials.darkIron}
              position={[-0.25, 0, z]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.05, 0.05, 0.45, 16]} />
            </mesh>
          ))}
          {/* Common Collector Pipe */}
          <mesh
            material={materials.darkIron}
            position={[0.15, -0.25, -0.4]}
            rotation={[Math.PI / 4, 0, 0]}
          >
            <cylinderGeometry args={[0.1, 0.1, 1.2, 20]} />
          </mesh>
        </group>
      )}

      {/* ---------------- 11. COOLING FAN ---------------- */}
      {wrapInteractive(
        'cooling_fan',
        <group
          position={[0, -0.2, 1.7]}
          rotation={[0, 0, crankAngleRad * 1.5]}
        >
          {/* Center Hub */}
          <mesh material={materials.plasticNylon} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.08, 24]} />
          </mesh>
          {/* 7 Aerodynamic Fan Blades */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const rot = (i * Math.PI * 2) / 7;
            return (
              <group key={i} rotation={[0, 0, rot]}>
                <mesh
                  material={materials.plasticNylon}
                  position={[0, 0.45, 0]}
                  rotation={[0.35, 0, 0]}
                >
                  <boxGeometry args={[0.12, 0.65, 0.015]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ---------------- 12. ALTERNATOR ---------------- */}
      {wrapInteractive(
        'alternator',
        <group position={[0.95, -0.25, 1.15]}>
          {/* Alternator Housing */}
          <mesh
            material={materials.castAluminum}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.22, 0.22, 0.35, 24]} />
          </mesh>
          {/* Pulley */}
          <mesh
            material={materials.forgedSteel}
            position={[0, 0, 0.22]}
            rotation={[Math.PI / 2, 0, crankAngleRad * 2.2]}
          >
            <cylinderGeometry args={[0.09, 0.09, 0.07, 20]} />
          </mesh>
        </group>
      )}

      {/* ---------------- 13. OIL FILTER ---------------- */}
      {wrapInteractive(
        'oil_filter',
        <group position={[0.85, -0.85, 0.35]} rotation={[0, 0, Math.PI / 4]}>
          {/* Canister Body */}
          <mesh material={materials.oilFilterBlue}>
            <cylinderGeometry args={[0.15, 0.15, 0.36, 24]} />
          </mesh>
          {/* Flange Mount */}
          <mesh material={materials.darkIron} position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.05, 24]} />
          </mesh>
        </group>
      )}

      {/* ---------------- 14. OIL SUMP (PAN) ---------------- */}
      {wrapInteractive(
        'oil_sump',
        <group position={[0, -1.25, 0]}>
          <mesh material={materials.darkIron}>
            <boxGeometry args={[1.35, 0.42, 2.5]} />
          </mesh>
          {/* Drain plug */}
          <mesh
            material={materials.copperBrass}
            position={[0, -0.22, -0.8]}
          >
            <cylinderGeometry args={[0.035, 0.035, 0.04, 12]} />
          </mesh>
        </group>
      )}

      {/* ---------------- 15. FLYWHEEL ---------------- */}
      {wrapInteractive(
        'flywheel',
        <group position={[0, CRANK_AXIS_Y, -1.6]} rotation={[0, 0, crankAngleRad]}>
          {/* Heavy Disc */}
          <mesh material={materials.darkIron} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.68, 0.68, 0.14, 48]} />
          </mesh>
          {/* Outer Starter Ring Gear Teeth Rim */}
          <mesh material={materials.forgedSteel} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.71, 0.71, 0.06, 64]} />
          </mesh>
        </group>
      )}

      {/* ---------------- 16. TIMING DRIVE (BELT & PULLEYS) ---------------- */}
      {wrapInteractive(
        'timing_drive',
        <group position={[0, 0.25, 1.5]}>
          {/* Crankshaft Timing Sprocket */}
          <mesh
            material={materials.forgedSteel}
            position={[0, CRANK_AXIS_Y - 0.25, 0]}
            rotation={[Math.PI / 2, 0, crankAngleRad]}
          >
            <cylinderGeometry args={[0.16, 0.16, 0.06, 24]} />
          </mesh>
          {/* Camshaft Timing Sprocket */}
          <mesh
            material={materials.forgedSteel}
            position={[0, 1.0, 0]}
            rotation={[Math.PI / 2, 0, crankAngleRad * 0.5]}
          >
            <cylinderGeometry args={[0.32, 0.32, 0.06, 32]} />
          </mesh>
          {/* Belt Representation */}
          <mesh material={materials.plasticNylon} position={[0, 0.35, 0]}>
            <boxGeometry args={[0.55, 1.45, 0.03]} />
          </mesh>
        </group>
      )}
    </group>
  );
};
