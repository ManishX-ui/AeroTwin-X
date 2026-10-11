import { LearningStep } from '../types/engine';

export const LEARNING_STEPS: LearningStep[] = [
  {
    id: 1,
    title: 'Introduction to the Four-Stroke Engine',
    subtitle: 'High-Level Overview of the Internal Combustion Assembly',
    focusComponentId: 'engine_block',
    cameraPosition: [3.5, 2.5, 4.0],
    cameraTarget: [0, 0, 0],
    content: 'Welcome to EngineVerse 3D! An internal combustion engine is a thermal heat engine that converts chemical energy stored in hydrocarbon fuel into mechanical work through controlled combustion inside closed cylinders. This four-cylinder, four-stroke inline configuration represents the world\'s most widely produced automotive powerplant architecture.',
    keyPoints: [
      'Four cylinders arranged linearly in a single inline bank.',
      'Operates on the four-stroke cycle: Intake, Compression, Power, and Exhaust.',
      'Requires two complete crankshaft revolutions (720 degrees) for all cylinders to complete one full thermodynamic cycle.'
    ],
    technicalTrivia: 'The four-stroke thermodynamic cycle was originally conceptualized by Alphonse Beau de Rochas in 1862 and practically realized by Nikolaus Otto in 1876, giving it the name "Otto Cycle".'
  },
  {
    id: 2,
    title: 'Engine Block & Cylinder Head: The Structural Backbone',
    subtitle: 'Containing Extreme Pressure and High Temperatures',
    focusComponentId: 'cylinder_head',
    cameraPosition: [2.5, 2.8, 3.2],
    cameraTarget: [0, 0.8, 0],
    content: 'The engine block forms the structural foundation, supporting the cylinders and crankshaft bearings. Mounted directly above it is the cylinder head, which houses the pent-roof combustion chambers, valves, spark plugs, and fuel injectors. Together, clamped under hundreds of kilonewtons of bolt force, they form a hermetic pressure vessel.',
    keyPoints: [
      'Engine block integrates internal water jackets that circulate coolant around cylinder walls.',
      'Cylinder head features cross-flow architecture: intake charge enters on one side, exhaust exits on the other.',
      'Multi-layer steel (MLS) head gasket withstands instantaneous combustion spikes up to 100+ bar.'
    ],
    technicalTrivia: 'A modern aluminum cylinder head accounts for nearly 20% of the total engine machining cost due to ultra-precise valve seat angles and fine micro-tolerances.'
  },
  {
    id: 3,
    title: 'Pistons & Cylinders: Energy Capture',
    subtitle: 'From Expanding Fireball to Linear Kinetic Force',
    focusComponentId: 'piston_1',
    cameraPosition: [1.8, 1.4, 2.2],
    cameraTarget: [0, 0.2, 0],
    content: 'Pistons are the primary movable boundary of the combustion chamber. When the air-fuel mixture ignites, expanding combustion gases push the piston downward with immense instantaneous thrust. Piston rings seal combustion gases above the piston while scraping excess oil from the cylinder walls below.',
    keyPoints: [
      'Piston crowns endure flame temperatures exceeding 2,200°C.',
      'Three-ring pack: top compression ring, second scraper ring, bottom oil control ring.',
      'Piston skirts are elliptical when cold and expand to a perfect cylinder at operating thermal equilibrium.'
    ],
    technicalTrivia: 'At 6,000 RPM, an automotive piston changes direction 200 times per second, experiencing accelerations exceeding 1,500 times the force of gravity (1,500 Gs)!'
  },
  {
    id: 4,
    title: 'Connecting Rods & Crankshaft: Motion Transformation',
    subtitle: 'Converting Reciprocating Motion into Continuous Shaft Rotation',
    focusComponentId: 'crankshaft',
    cameraPosition: [2.8, -0.6, 3.0],
    cameraTarget: [0, -0.5, 0],
    content: 'Linear motion from the pistons must be converted into rotational torque to drive the wheels or propeller. Connecting rods link each piston to an offset crankpin on the crankshaft. As the piston pushes downward, the crank throw rotates around the main bearing axis, producing torque.',
    keyPoints: [
      'Crankshaft counterweights dynamically balance the rotating mass of rod big-ends and reciprocating piston mass.',
      'Flat-plane inline-4 crank has crankpins 1 & 4 at 0° and crankpins 2 & 3 at 180°.',
      'Pressurized hydrodynamic oil films float journals so metal surfaces never touch during normal operation.'
    ],
    technicalTrivia: 'The oil film thickness between the crankshaft journal and bearing shell is only 15 to 25 microns—roughly one-fourth the thickness of a single human hair!'
  },
  {
    id: 5,
    title: 'Double Overhead Camshaft (DOHC) & Valvetrain',
    subtitle: 'Precision Gas Exchange & Millisecond Valve Actuation',
    focusComponentId: 'camshaft',
    cameraPosition: [2.0, 3.0, 2.2],
    cameraTarget: [0, 1.2, 0],
    content: 'The valvetrain governs when fresh air enters and burnt gas leaves. Camshafts have teardrop-shaped lobes that push valves downward against heavy valve springs. Because each cylinder completes its cycle over 720° of crank rotation, the camshaft rotates at exactly half crankshaft speed (1:2 ratio).',
    keyPoints: [
      'Intake valves open to let in air-fuel mixture; exhaust valves open to evacuate spent gas.',
      'Stiff valve springs snap valves closed instantly to prevent high-RPM "valve float".',
      'Timing belt or chain locks the camshaft in precise synchronization with the crankshaft.'
    ],
    technicalTrivia: 'Sodium-filled exhaust valves use liquid sodium sloshing inside hollow stems to conduct heat away from the valve head, dropping face temperature by up to 100°C.'
  },
  {
    id: 6,
    title: 'Fuel Metering & Induction System',
    subtitle: 'Air Distribution & Micro-Orifice Atomization',
    focusComponentId: 'fuel_injector',
    cameraPosition: [-2.8, 1.5, 2.0],
    cameraTarget: [-0.5, 0.5, 0],
    content: 'Air enters through the throttle body into the intake manifold plenum, which distributes airflow evenly into each cylinder runner. High-pressure fuel injectors spray finely atomized fuel droplets into the intake port or directly into the combustion chamber, achieving optimal air-fuel mixing.',
    keyPoints: [
      'Target stoichiometric air-fuel ratio is 14.7 parts air to 1 part gasoline by mass.',
      'Atomized fuel droplets must be under 20 microns in diameter for rapid vaporization.',
      'Tuned intake runner lengths create acoustic ram-charging effects at specific engine RPMs.'
    ],
    technicalTrivia: 'At high RPM, fuel injectors fire and shut in under 2 milliseconds—less than the blink of an eye!'
  },
  {
    id: 7,
    title: 'Ignition System: Triggering the Power Stroke',
    subtitle: 'High-Voltage Plasma Discharges & Flame Kernel Growth',
    focusComponentId: 'spark_plug_1',
    cameraPosition: [1.2, 2.6, 1.8],
    cameraTarget: [0, 1.0, 0],
    content: 'Just before the piston reaches Top Dead Center on the compression stroke, the spark plug fires. An ignition coil transforms 12V battery power into a 30,000+ Volt pulse, jumping the electrode gap in a miniature lightning bolt that initiates the combustion flame front.',
    keyPoints: [
      'Ignition timing is advanced before TDC (e.g., 15°-25° BTDC) to allow time for the flame front to spread.',
      'Iridium and platinum electrode tips survive millions of high-energy plasma arcs with minimal erosion.',
      'Optimum cylinder peak pressure occurs around 14° to 18° after Top Dead Center (ATDC).'
    ],
    technicalTrivia: 'The electric plasma channel across a firing spark plug electrode reaches temperatures exceeding 3,000°C—hotter than the surface of the sun!'
  },
  {
    id: 8,
    title: 'Cooling System: Dissipating Extreme Thermal Flux',
    subtitle: 'Preventing Thermal Runaway and Detonation',
    focusComponentId: 'cooling_fan',
    cameraPosition: [0.5, 1.2, 3.8],
    cameraTarget: [0, 0, 0.5],
    content: 'Combustion generates temperatures up to 2,500°C. Without continuous cooling, aluminum pistons and cylinder heads would melt within seconds. A water pump circulates coolant through block jackets to the radiator, where the cooling fan draws cool ambient airflow across the matrix.',
    keyPoints: [
      'Roughly one-third of all heat energy liberated by fuel is rejected into the cooling system.',
      'Pressurized cooling systems operate up to 1.4 bar, raising the coolant boiling point to ~125°C.',
      'Engine cooling fan ensures positive airflow during vehicle standstill, traffic, or taxiing.'
    ],
    technicalTrivia: 'Coolant is a 50/50 mix of ethylene glycol and demineralized water: water provides superior specific heat capacity, while glycol prevents freezing down to -37°C and lubricates pump seals.'
  },
  {
    id: 9,
    title: 'Lubrication System: Hydrodynamic Friction Elimination',
    subtitle: 'Oil Pump, Pressurized Galleries & Micro-Filtration',
    focusComponentId: 'oil_filter',
    cameraPosition: [2.6, -1.0, 2.2],
    cameraTarget: [0.5, -0.4, 0],
    content: 'Engine oil provides lubrication, cooling, cleaning, and corrosion protection. Stored in the oil sump pan, oil is drawn through a strainer by the engine-driven oil pump, pumped through the oil filter to trap abrasive particulates down to 20 microns, and fed through drilled crankshaft galleries to all bearings.',
    keyPoints: [
      'Main bearings and rod bearings operate under hydrodynamic lubrication: metal surfaces never make contact.',
      'Piston oil squirt jets spray cool oil directly against the underside of hot piston crowns.',
      'Spin-on oil filter contains an internal bypass valve to ensure oil flow even if filter media becomes saturated.'
    ],
    technicalTrivia: 'Modern synthetic multi-grade motor oils (like 0W-20) use viscosity index improvers that flow like thin oil in sub-zero winters yet maintain film strength in scorching summer traffic.'
  },
  {
    id: 10,
    title: 'Exhaust System: Scavenging & Emissions Management',
    subtitle: 'Pulse Scavenging and Environmental Emission Abatement',
    focusComponentId: 'exhaust_manifold',
    cameraPosition: [3.2, 1.0, 1.5],
    cameraTarget: [0.5, 0.4, 0],
    content: 'The exhaust manifold collects supersonic, 800°C pulses of burnt gas from all cylinders. Tuned 4-into-1 header pipes harness the kinetic energy of exhaust pulses to create low-pressure vacuum waves that actively pull residual exhaust out of adjacent cylinders during valve overlap.',
    keyPoints: [
      'Exhaust headers are crafted from high-temperature ductile iron or austenitic stainless steel.',
      'Oxygen sensors measure residual oxygen in exhaust stream to maintain closed-loop fuel feedback.',
      'Downstream catalytic converters use platinum, palladium, and rhodium catalysts to convert toxic CO, HC, and NOx into CO2, H2O, and N2.'
    ],
    technicalTrivia: 'The glowing cherry-red temperature of high-performance exhaust headers under sustained load can reach 950°C—hot enough to melt brass and copper!'
  },
  {
    id: 11,
    title: 'The Four-Stroke Thermodynamic Cycle (Otto Cycle)',
    subtitle: 'The 720-Degree Symphony of Mechanical Power',
    focusComponentId: 'piston_1',
    cameraPosition: [3.0, 1.8, 3.2],
    cameraTarget: [0, 0.2, 0],
    content: 'The complete cycle consists of four distinct piston strokes spanning 720° of crankshaft rotation: (1) INTAKE: piston descends, intake valve opens, sucking in air-fuel mixture; (2) COMPRESSION: piston rises, all valves closed, squeezing mixture; (3) POWER: spark fires, combustion expands gases, driving piston down; (4) EXHAUST: piston ascends, exhaust valve opens, expelling burnt gases.',
    keyPoints: [
      'Stroke 1 (0°-180°): INTAKE stroke—downward piston travel with intake valve open.',
      'Stroke 2 (180°-360°): COMPRESSION stroke—upward travel with all valves sealed.',
      'Stroke 3 (360°-540°): POWER stroke—rapid gas expansion driving piston downward.',
      'Stroke 4 (540°-720°): EXHAUST stroke—upward sweep expelling combustion products.'
    ],
    technicalTrivia: 'Only one of the four strokes (the Power stroke) generates positive work; the other three strokes consume stored flywheel momentum to prepare for the next power cycle!'
  }
];
