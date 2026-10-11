import { ComponentMetadata } from '../types/engine';

export const ENGINE_COMPONENTS: ComponentMetadata[] = [
  {
    id: 'engine_block',
    displayName: 'Engine Block (Crankcase)',
    category: 'structure',
    categoryName: 'Structural Engine Assembly',
    subsystem: 'Main Engine Block',
    description: 'The foundational structural casting that houses cylinders, coolant jackets, oil galleries, and crankshaft main bearings.',
    function: 'Provides structural rigidity, aligns cylinders with the crankshaft, and withstands peak combustion pressures up to 80-120 bar.',
    workingPrinciple: 'Rigid monolith cast from grey cast iron or hypereutectic aluminum alloy with pressed-in cast iron liners to minimize thermal distortion.',
    location: 'Central core of the engine assembly below the cylinder head and above the oil sump.',
    material: 'A356-T6 Aluminum Alloy or CGI (Compacted Graphite Iron)',
    operatingTemp: '85°C – 105°C (coolant stabilized)',
    tolerance: 'Bore cylindrical tolerance ±0.005 mm',
    roleInCycle: {
      INTAKE: 'Maintains cylinder bore roundness while low-pressure depression occurs.',
      COMPRESSION: 'Absorbs side-thrust forces exerted by pistons against cylinder walls.',
      POWER: 'Contains explosive gas expansion forces and transfers reactive torque to mounts.',
      EXHAUST: 'Channels heat from cylinder walls into surrounding water jackets.'
    },
    educationalFacts: [
      'Modern aluminum engine blocks save 40-50% mass compared to traditional cast iron.',
      'Cross-bolted main bearing caps resist high-RPM crankshaft flex and vibration harmonics.',
      'Siamese cylinder bore designs maximize cylinder volume within compact overall engine length.'
    ],
    failureSymptoms: [
      'Cracked water jacket due to freeze expansion or extreme thermal shock.',
      'Cylinder bore scoring caused by particulate debris or lack of oil film lubrication.',
      'Main bearing web distortion under detonation or extreme over-boost.'
    ],
    relatedComponentIds: ['cylinder_head', 'cylinder_1', 'crankshaft', 'oil_sump'],
    meshNames: ['mesh_engine_block'],
    explosionVector: [0, 0, 0],
    canIsolate: true
  },
  {
    id: 'cylinder_head',
    displayName: 'Cylinder Head Assembly',
    category: 'structure',
    categoryName: 'Structural Engine Assembly',
    subsystem: 'Combustion Chamber & Valvetrain Enclosure',
    description: 'Precision-machined upper casting containing combustion chambers, intake/exhaust ports, valve guides, and camshaft bearings.',
    function: 'Seals the top of cylinders, houses the spark plugs and fuel injectors, and directs gas flow into and out of each cylinder.',
    workingPrinciple: 'Clamped to the block via high-tensile torque-to-yield head bolts and multi-layer steel (MLS) head gasket to maintain hermetic gas seal.',
    location: 'Mounted directly on top of the engine block.',
    material: 'Heat-treated Aluminum Alloy (AlSi7Mg)',
    operatingTemp: '120°C – 220°C around exhaust ports',
    tolerance: 'Deck surface flatness within 0.03 mm',
    roleInCycle: {
      INTAKE: 'Curved intake port creates high tumble and swirl for incoming fuel-air charge.',
      COMPRESSION: 'Compact pent-roof combustion chamber optimizes squish area and flame travel distance.',
      POWER: 'Transfers intense combustion heat directly to internal coolant jackets.',
      EXHAUST: 'Exhaust port guides supersonic combustion gases smoothly into exhaust manifold.'
    },
    educationalFacts: [
      'Pent-roof combustion chambers allow 4 valves per cylinder for superior volumetric efficiency.',
      'Sodium-filled exhaust valve stems transfer heat up into the cylinder head cooling passages.',
      'MLS gaskets have elastomeric polymer coatings that seal micro-crevices under thermal expansion.'
    ],
    failureSymptoms: [
      'Blown head gasket causing coolant in engine oil (milky oil emulsion) or white exhaust smoke.',
      'Warpage caused by severe cooling system failure and overheating.',
      'Valve seat recession causing compression loss and rough idle.'
    ],
    relatedComponentIds: ['engine_block', 'camshaft', 'intake_valve_1', 'spark_plug_1'],
    meshNames: ['mesh_cylinder_head'],
    explosionVector: [0, 1.2, 0],
    canIsolate: true
  },
  {
    id: 'cylinder_1',
    displayName: 'Cylinder Bore & Liner #1',
    category: 'structure',
    categoryName: 'Cylinder Assembly',
    subsystem: 'Combustion Chamber & Bore',
    description: 'Precision-honed cylindrical chamber where combustion occurs and piston #1 reciprocates.',
    function: 'Contains combustion pressure, guides piston travel along the vertical stroke axis, and conducts heat away to cooling jackets.',
    workingPrinciple: 'Cross-hatch honed surface finish (plateau honing at 45° angle) retains micron-scale oil film to lubricate piston rings.',
    location: 'Forwardmost cylinder position (Front of inline-4 engine).',
    material: 'Centrifugally cast ductile iron liner or Nikasil coating',
    operatingTemp: '180°C (top ring reversal zone)',
    tolerance: 'Bore diameter: 82.500 mm ± 0.008 mm',
    roleInCycle: {
      INTAKE: 'Volume expands from TDC to BDC creating depression that ingests atmospheric charge.',
      COMPRESSION: 'Compresses fuel-air charge into combustion chamber at 10.5:1 compression ratio.',
      POWER: 'Peak pressure pushes piston down with up to 45,000 N instantaneous force.',
      EXHAUST: 'Piston sweeps burned charge out through opening exhaust valve.'
    },
    educationalFacts: [
      'Cross-hatch angle of 30-45° is essential: too steep causes excessive oil consumption, too flat starves rings.',
      'Top cylinder zone suffers highest wear because oil film is burned away during power stroke.'
    ],
    failureSymptoms: [
      'Cylinder glazing from prolonged light-load running, preventing ring seal.',
      'Vertical scoring from broken ring lands or foreign particle ingestion.'
    ],
    relatedComponentIds: ['piston_1', 'spark_plug_1', 'engine_block'],
    meshNames: ['mesh_cylinder_1'],
    explosionVector: [0, 0, 0],
    canIsolate: true
  },
  {
    id: 'piston_1',
    displayName: 'Piston #1 Assembly',
    category: 'reciprocating',
    categoryName: 'Piston Assembly',
    subsystem: 'Power Conversion Mechanism',
    description: 'Lightweight forged aluminum cylindrical plug with crown bowl, ring grooves, and gudgeon pin boss.',
    function: 'Receives the force of expanding combustion gases and transmits it through the gudgeon pin to the connecting rod.',
    workingPrinciple: 'Slightly oval and barrel-shaped when cold; thermal expansion at operating temperature makes it perfectly round.',
    location: 'Inside Cylinder #1, linked to Connecting Rod #1.',
    material: 'Forged 4032 High-Silicon Aluminum Alloy',
    operatingTemp: '280°C crown / 140°C skirt',
    tolerance: 'Piston-to-bore clearance: 0.035 mm',
    roleInCycle: {
      INTAKE: 'Moves downward from TDC (0°) to BDC (180°), creating low-pressure depression.',
      COMPRESSION: 'Moves upward from BDC (180°) to TDC (360°), compressing charge.',
      POWER: 'Driven downward from TDC (360°) to BDC (540°) by expanding combustion fireball.',
      EXHAUST: 'Pushes upward from BDC (540°) to TDC (720°), sweeping exhaust gas out.'
    },
    educationalFacts: [
      'Carries three rings: Top Compression Ring, Second Scraper Ring, and Bottom Oil Control Ring.',
      'Piston skirts are coated with molybdenum disulfide (MoS2) to minimize cold-start friction.',
      'Under 6000 RPM, the piston accelerates from zero to over 20 m/s and stops twice every revolution!'
    ],
    failureSymptoms: [
      'Piston crown holing from detonation or pre-ignition hot spots.',
      'Skirt scuffing from localized lack of lubrication or extreme thermal growth.',
      'Broken ring lands causing blow-by gas pressurizing crankcase.'
    ],
    relatedComponentIds: ['connecting_rod_1', 'cylinder_1', 'spark_plug_1', 'crankshaft'],
    meshNames: ['mesh_piston_1'],
    explosionVector: [0, 0.6, 0],
    canIsolate: true
  },
  {
    id: 'piston_2',
    displayName: 'Piston #2 Assembly',
    category: 'reciprocating',
    categoryName: 'Piston Assembly',
    subsystem: 'Power Conversion Mechanism',
    description: 'Second cylinder piston reciprocating 180° out of phase with Piston #1 in flat-plane crankshaft arrangement.',
    function: 'Receives combustion gas energy in Cylinder #2, executing Intake stroke when Piston #1 is on Power stroke.',
    workingPrinciple: 'Identical design to Piston #1, balanced within ±1 gram for smooth engine balance.',
    location: 'Inside Cylinder #2, linked to Connecting Rod #2.',
    material: 'Forged 4032 High-Silicon Aluminum Alloy',
    operatingTemp: '280°C crown',
    roleInCycle: {
      INTAKE: '0°-180°: Downward intake stroke drawing fresh charge.',
      COMPRESSION: '180°-360°: Upward compression stroke.',
      POWER: '360°-540°: Downward power stroke.',
      EXHAUST: '540°-720°: Upward exhaust stroke.'
    },
    educationalFacts: ['Operates 180° opposite Piston #1 on standard inline-4 flat-plane crank.'],
    failureSymptoms: ['Ring sticking, blow-by, crown detonation damage.'],
    relatedComponentIds: ['connecting_rod_2', 'crankshaft'],
    meshNames: ['mesh_piston_2'],
    explosionVector: [0, 0.6, 0],
    canIsolate: true
  },
  {
    id: 'piston_3',
    displayName: 'Piston #3 Assembly',
    category: 'reciprocating',
    categoryName: 'Piston Assembly',
    subsystem: 'Power Conversion Mechanism',
    description: 'Third cylinder piston paired in phase with Piston #2 in flat-plane crankshaft geometry.',
    function: 'Receives combustion pressure during Cylinder #3 power stroke (Firing order position 2: 1-3-4-2).',
    workingPrinciple: 'Transmits linear reciprocating energy to crankshaft journal #3.',
    location: 'Inside Cylinder #3, linked to Connecting Rod #3.',
    material: 'Forged 4032 High-Silicon Aluminum Alloy',
    operatingTemp: '280°C crown',
    roleInCycle: {
      INTAKE: '540°-720°: Downward intake stroke.',
      COMPRESSION: '0°-180°: Upward compression stroke.',
      POWER: '180°-360°: Downward power stroke firing immediately after Cylinder #1.',
      EXHAUST: '360°-540°: Upward exhaust stroke.'
    },
    educationalFacts: ['In 1-3-4-2 firing order, Cylinder #3 fires second, precisely 180° crank angle after Cylinder #1.'],
    failureSymptoms: ['Piston scuffing, overheating, ring wear.'],
    relatedComponentIds: ['connecting_rod_3', 'crankshaft'],
    meshNames: ['mesh_piston_3'],
    explosionVector: [0, 0.6, 0],
    canIsolate: true
  },
  {
    id: 'piston_4',
    displayName: 'Piston #4 Assembly',
    category: 'reciprocating',
    categoryName: 'Piston Assembly',
    subsystem: 'Power Conversion Mechanism',
    description: 'Fourth cylinder piston paired in motion with Piston #1 (reaches TDC simultaneously with Cyl 1).',
    function: 'Receives combustion pressure in Cylinder #4, completing firing sequence (1-3-4-2).',
    workingPrinciple: 'Operates in mechanical symmetry with Piston #1 for primary rocking-couple cancellation.',
    location: 'Inside rear Cylinder #4, linked to Connecting Rod #4.',
    material: 'Forged 4032 High-Silicon Aluminum Alloy',
    operatingTemp: '280°C crown',
    roleInCycle: {
      INTAKE: '180°-360°: Downward intake stroke.',
      COMPRESSION: '360°-540°: Upward compression stroke.',
      POWER: '540°-720°: Downward power stroke.',
      EXHAUST: '0°-180°: Upward exhaust stroke.'
    },
    educationalFacts: ['Cylinder #4 fires at 540° crank angle, providing continuous power impulses every 180°.'],
    failureSymptoms: ['Detonation, ring seizure, scuffing.'],
    relatedComponentIds: ['connecting_rod_4', 'crankshaft'],
    meshNames: ['mesh_piston_4'],
    explosionVector: [0, 0.6, 0],
    canIsolate: true
  },
  {
    id: 'connecting_rod_1',
    displayName: 'Connecting Rod #1',
    category: 'reciprocating',
    categoryName: 'Crankshaft & Rod Assembly',
    subsystem: 'Kinematic Linkage',
    description: 'Forged H-beam steel rod connecting Piston #1 gudgeon pin to crankshaft rod journal #1.',
    function: 'Converts reciprocating linear motion of the piston into rotational motion of the crankshaft.',
    workingPrinciple: 'Subject to intense alternating tensile (during exhaust stroke reversal) and compressive (during power stroke) stresses.',
    location: 'Enclosed in engine block between Piston #1 and Crankshaft rod journal #1.',
    material: 'Forged 4340 Chrome-Moly Steel or Titanium Alloy',
    operatingTemp: '90°C – 120°C',
    tolerance: 'Center-to-center length tolerance ±0.015 mm',
    roleInCycle: {
      INTAKE: 'Pulls piston downward against crankpin.',
      COMPRESSION: 'Pushes piston upward to compress mixture.',
      POWER: 'Transfers 40+ kN explosive force from piston crown into crankpin at an angle, creating torque.',
      EXHAUST: 'Pushes piston upward to evacuate cylinder.'
    },
    educationalFacts: [
      'Cracked-cap rod manufacturing snaps the rod cap at microscopic grain boundaries for zero-play reassembly.',
      'Rod length to stroke ratio (typically 1.6 to 1.8) determines piston dwell time and cylinder wall side-thrust.'
    ],
    failureSymptoms: [
      'Rod bearing spin from oil starvation, causing violent rod knock sound.',
      'Hydro-lock bending when water or unmetered fuel enters combustion chamber.',
      'Fatigue failure throwing a rod through the engine block.'
    ],
    relatedComponentIds: ['piston_1', 'crankshaft'],
    meshNames: ['mesh_connecting_rod_1'],
    explosionVector: [0, 0.3, 0],
    canIsolate: true
  },
  {
    id: 'crankshaft',
    displayName: 'Crankshaft Assembly',
    category: 'rotating',
    categoryName: 'Rotating Assembly',
    subsystem: 'Engine Output Shaft',
    description: 'Precision forged steel counterweighted shaft with 5 main bearing journals and 4 rod pin throws.',
    function: 'Transforms linear reciprocating piston strokes into rotational torque delivered to the flywheel and transmission.',
    workingPrinciple: 'Flat-plane 180° layout (throws 1 & 4 at 0°, throws 2 & 3 at 180°). Counterweights offset rotating and reciprocating mass.',
    location: 'Spans the lower bedplate / crankcase of the engine block.',
    material: 'Forged 42CrMo4 Forged Alloy Steel with nitrided journals',
    operatingTemp: '85°C – 110°C (oil cooled)',
    tolerance: 'Journal runout under 0.005 mm, micro-finish Ra 0.1 µm',
    roleInCycle: {
      INTAKE: 'Rotates 180°, pulling intake piston down.',
      COMPRESSION: 'Rotates 180°, pushing compression piston up with kinetic momentum.',
      POWER: 'Receives direct mechanical torque impulse from firing cylinder.',
      EXHAUST: 'Maintains uniform angular momentum through attached flywheel inertia.'
    },
    educationalFacts: [
      'Internal drilled oil passages feed high-pressure oil from main bearings directly to connecting rod bearings.',
      'Nitriding hardening creates a 0.3 mm deep wear-resistant layer with high compressive residual stress.',
      'A torsional vibration damper (harmonic balancer) on front snout absorbs crankshaft twist resonance.'
    ],
    failureSymptoms: [
      'Spun main bearings from low oil pressure or high oil aeration.',
      'Fatigue fillet cracks from over-revving or improper torsional damping.',
      'Excessive crankshaft end-play from worn thrust washers.'
    ],
    relatedComponentIds: ['engine_block', 'flywheel', 'connecting_rod_1', 'timing_drive'],
    meshNames: ['mesh_crankshaft'],
    explosionVector: [0, -0.6, 0],
    canIsolate: true
  },
  {
    id: 'camshaft',
    displayName: 'Double Overhead Camshaft (DOHC)',
    category: 'valvetrain',
    categoryName: 'Valvetrain Assembly',
    subsystem: 'Valve Timing Control',
    description: 'Precision-ground steel shaft with egg-shaped lobes that depress intake and exhaust valves.',
    function: 'Accurately opens and closes intake and exhaust valves at predetermined angular intervals.',
    workingPrinciple: 'Driven by the crankshaft via timing belt/chain at exactly 1:2 rotational ratio (camshaft turns 1 revolution for every 2 crankshaft revolutions).',
    location: 'Mounted atop the cylinder head above the valves.',
    material: 'Chilled Cast Iron or Case-hardened 8620 Steel',
    operatingTemp: '90°C – 110°C',
    tolerance: 'Lobe profile tolerance ±0.005 mm',
    roleInCycle: {
      INTAKE: 'Intake cam lobe pushes intake valve open during intake stroke.',
      COMPRESSION: 'Base circle rotates across valve lifter, keeping valve tightly shut.',
      POWER: 'Base circle keeps both valves hermetically closed during combustion.',
      EXHAUST: 'Exhaust cam lobe pushes exhaust valve open to expel burnt gas.'
    },
    educationalFacts: [
      'DOHC (Double Overhead Cam) uses one camshaft for intake valves and another for exhaust valves.',
      'Variable Valve Timing (VVT) hydraulically phases the camshaft relative to crank timing for low-end torque and high-end power.',
      'Lobe separation angle (LSA) controls valve overlap—the period when intake and exhaust are simultaneously cracked open.'
    ],
    failureSymptoms: [
      'Lobe flat-spot wear from depleted zinc (ZDDP) anti-wear additives in motor oil.',
      'Timing belt jump causing piston-to-valve collision in interference engines.',
      'Camshaft journal galling from dry cold starts.'
    ],
    relatedComponentIds: ['cylinder_head', 'intake_valve_1', 'timing_drive'],
    meshNames: ['mesh_camshaft'],
    explosionVector: [0, 1.6, 0],
    canIsolate: true
  },
  {
    id: 'intake_valve_1',
    displayName: 'Intake Valve #1',
    category: 'valvetrain',
    categoryName: 'Valvetrain Assembly',
    subsystem: 'Gas Exchange Mechanism',
    description: 'Poppet valve with large trumpet head that controls airflow into Cylinder #1.',
    function: 'Opens to allow atmospheric or boosted air-fuel charge into the cylinder; seals tightly during compression and power.',
    workingPrinciple: 'Depressed downward into cylinder by camshaft lobe; snapped shut by stiff valve spring.',
    location: 'Seated in cylinder head intake port above Cylinder #1.',
    material: 'Silchrome Martensitic Stainless Steel (21-4N)',
    operatingTemp: '250°C – 350°C (cooled by incoming fuel-air charge)',
    tolerance: 'Valve seat runout under 0.015 mm',
    roleInCycle: {
      INTAKE: 'Opens fully (8-10 mm lift) to admit incoming air-fuel charge.',
      COMPRESSION: 'Closes before piston rises, sealing combustion chamber.',
      POWER: 'Remains sealed against seat under 80+ bar peak cylinder pressure.',
      EXHAUST: 'Remains shut while exhaust valve expels gases.'
    },
    educationalFacts: [
      'Intake valves are larger than exhaust valves because intake air is driven only by atmospheric depression, whereas exhaust is driven by positive pressure.',
      'Modern engines use two intake valves per cylinder to maximize valve curtain area.'
    ],
    failureSymptoms: [
      'Carbon deposits on back of valve from Direct Injection (GDI) fuel systems without port wash.',
      'Bent valve stem from timing belt snap causing piston contact.',
      'Valve float at excessive RPM when spring cannot return valve quickly enough.'
    ],
    relatedComponentIds: ['camshaft', 'cylinder_head', 'cylinder_1'],
    meshNames: ['mesh_intake_valve_1'],
    explosionVector: [0, 1.4, -0.3],
    canIsolate: true
  },
  {
    id: 'exhaust_valve_1',
    displayName: 'Exhaust Valve #1',
    category: 'valvetrain',
    categoryName: 'Valvetrain Assembly',
    subsystem: 'Gas Exchange Mechanism',
    description: 'Heavy-duty heat-resistant poppet valve that evacuates hot combustion gases from Cylinder #1.',
    function: 'Opens near the end of the power stroke to release spent exhaust gas into the exhaust manifold.',
    workingPrinciple: 'Depressed by exhaust camshaft lobe; seals against stellited valve seat.',
    location: 'Seated in cylinder head exhaust port above Cylinder #1.',
    material: 'Inconel 751 Superalloy / Stellite faced, often sodium-filled',
    operatingTemp: '650°C – 850°C (runs glowing cherry red!)',
    tolerance: 'Stem-to-guide clearance: 0.030 mm',
    roleInCycle: {
      INTAKE: 'Remains closed while fresh charge enters.',
      COMPRESSION: 'Seals tightly against cylinder head seat.',
      POWER: 'Cracks open just before BDC to initiate exhaust blowdown.',
      EXHAUST: 'Fully open as piston sweeps upward, channeling hot gas out.'
    },
    educationalFacts: [
      'Hollow sodium-filled valve stems liquefy at 98°C, sloshing heat from valve head up into guide and coolant passages.',
      'Operates under the most extreme thermal stress of any engine moving part (up to 850°C).'
    ],
    failureSymptoms: [
      'Burned valve face from loss of seat contact preventing heat dissipation.',
      'Exhaust valve guide wear causing blue oil smoke on deceleration.'
    ],
    relatedComponentIds: ['camshaft', 'cylinder_head', 'exhaust_manifold'],
    meshNames: ['mesh_exhaust_valve_1'],
    explosionVector: [0, 1.4, 0.3],
    canIsolate: true
  },
  {
    id: 'spark_plug_1',
    displayName: 'Spark Plug #1',
    category: 'ignition',
    categoryName: 'Ignition System',
    subsystem: 'Combustion Trigger',
    description: 'High-voltage electrode encased in alumina ceramic insulator threaded into Cylinder #1 roof.',
    function: 'Ignites the compressed air-fuel mixture with an electrical plasma discharge spark at exact crankshaft timing.',
    workingPrinciple: 'Receives 25,000–40,000 Volts from the ignition coil, ionizing the gap between center and ground electrodes to create a 3,000°C plasma arc.',
    location: 'Threaded centrally into Cylinder Head #1 combustion dome.',
    material: 'High-purity Alumina Ceramic insulator, Iridium/Platinum fine-wire electrode',
    operatingTemp: '450°C – 850°C self-cleaning temperature',
    tolerance: 'Electrode gap: 0.8 mm – 1.1 mm',
    roleInCycle: {
      INTAKE: 'Passive; cooled slightly by fresh incoming intake charge.',
      COMPRESSION: 'Fires 10°–35° Before Top Dead Center (BTDC) to initiate flame front.',
      POWER: 'Surrounded by burning flame kernel reaching 2,500°C peak temperature.',
      EXHAUST: 'Passive; exposed to burning exhaust gas flow.'
    },
    educationalFacts: [
      'Iridium center electrodes are laser-welded with fine tips (0.4-0.6 mm) requiring less firing voltage.',
      'Heat range determines insulator length: "Cold" plugs conduct heat away rapidly to prevent pre-ignition in boosted engines.',
      'The spark duration lasts only about 1.5 to 2.0 milliseconds!'
    ],
    failureSymptoms: [
      'Carbon fouling from overly rich mixture or persistent short trips.',
      'Electrode erosion from high mileage causing wide gap and ignition misfires.',
      'Detonation speckling with tiny melted aluminum beads on porcelain insulator.'
    ],
    relatedComponentIds: ['cylinder_head', 'cylinder_1', 'ignition_region'],
    meshNames: ['mesh_spark_plug_1'],
    explosionVector: [0, 1.8, 0],
    canIsolate: true
  },
  {
    id: 'fuel_injector',
    displayName: 'High-Pressure Fuel Injector',
    category: 'induction',
    categoryName: 'Fuel & Induction System',
    subsystem: 'Fuel Metering',
    description: 'Electromagnetic solenoid or piezoelectric valve that sprays finely atomized fuel into port or cylinder.',
    function: 'Meters precise fuel mass matching airflow for target stoichiometric air-fuel ratio (14.7:1 for gasoline).',
    workingPrinciple: 'Engine Control Unit (ECU) pulses solenoid coil for 1.5 to 15 milliseconds, lifting needle valve off microscopic multi-hole orifice nozzle.',
    location: 'Mounted in intake manifold runner (Port Injection) or cylinder head (Direct Injection).',
    material: 'Stainless Steel housing with DLC (Diamond-Like Carbon) coated pintle',
    operatingTemp: '60°C – 120°C',
    tolerance: 'Nozzle micro-holes 0.12 mm diameter',
    roleInCycle: {
      INTAKE: 'Sprays atomized fuel mist during intake valve opening window.',
      COMPRESSION: 'Seals shut under high cylinder back-pressure.',
      POWER: 'Closed; monitors fuel rail pressure.',
      EXHAUST: 'Closed.'
    },
    educationalFacts: [
      'Gasoline Direct Injection (GDI) operates at 150 to 350 bar (2,200 to 5,000 psi) pressure.',
      'Micro-orifice nozzles break fuel into droplets under 20 microns for rapid evaporation and clean burning.'
    ],
    failureSymptoms: [
      'Clogged nozzle orifice from fuel lacquer deposits causing lean misfire.',
      'Leaking injector dripping fuel into cylinder, washing oil off bore and causing fuel dilution.'
    ],
    relatedComponentIds: ['intake_manifold', 'cylinder_head', 'spark_plug_1'],
    meshNames: ['mesh_fuel_injector'],
    explosionVector: [-1.2, 1.1, 0],
    canIsolate: true
  },
  {
    id: 'ignition_region',
    displayName: 'Ignition & Flame Propagation Zone',
    category: 'ignition',
    categoryName: 'Ignition & Combustion Zone',
    subsystem: 'Combustion Chamber Core',
    description: 'The geometric volume between the piston crown bowl, cylinder head roof, and cylinder walls where ignition initiates and flame burns.',
    function: 'Encloses the rapid exothermic chemical reaction converting chemical fuel energy into high-temperature expanding gas pressure.',
    workingPrinciple: 'Spark arc creates initial flame kernel; laminar and turbulent flame front propagates across chamber at 20-30 m/s.',
    location: 'Inside combustion chamber atop cylinder bore when piston approaches TDC.',
    material: 'Transient Plasma and Burning Hydrocarbon Gas mixture',
    operatingTemp: '2,200°C – 2,600°C peak combustion flame temperature',
    roleInCycle: {
      INTAKE: 'Filled with homogenous air-fuel mixture.',
      COMPRESSION: 'Tumble swirl turbulence breaks mixture into fine eddies.',
      POWER: 'Ignites! Pressure spikes from 15 bar to 80+ bar, driving piston downward.',
      EXHAUST: 'Burnt combustion products evacuated.'
    },
    educationalFacts: [
      'Detonation occurs when end-gas auto-ignites spontaneously before flame front reaches it, producing damaging shockwaves.',
      'Flame speed increases with cylinder turbulence, which is why squish bands are engineered into the cylinder head.'
    ],
    failureSymptoms: [
      'Engine knock (pinging) from low octane fuel or excessive ignition advance.',
      'Incomplete combustion leaving unburned hydrocarbons (HC) and soot.'
    ],
    relatedComponentIds: ['spark_plug_1', 'piston_1', 'cylinder_head'],
    meshNames: ['mesh_ignition_region'],
    explosionVector: [0, 0, 0],
    canIsolate: true
  },
  {
    id: 'cooling_fan',
    displayName: 'Radiator Cooling Fan',
    category: 'cooling',
    categoryName: 'Cooling System',
    subsystem: 'Engine Thermal Management',
    description: 'Multi-blade aerodynamic axial fan mounted at front of engine to draw airflow across the radiator matrix.',
    function: 'Maintains airflow through the radiator core during idle, low speed, or high engine thermal load.',
    workingPrinciple: 'Driven by serpentine accessory belt with viscous clutch or thermostatically controlled electric brushless DC motor.',
    location: 'Mounted on front of engine facing vehicle radiator.',
    material: 'Glass-fiber reinforced Polyamide (Nylon) composite',
    operatingTemp: '-30°C – 110°C ambient',
    roleInCycle: {
      INTAKE: 'Maintains steady engine block thermal equilibrium.',
      COMPRESSION: 'Prevents cylinder hot spots that trigger pre-ignition.',
      POWER: 'Carries away ~30% of total fuel thermal energy rejected through cooling system.',
      EXHAUST: 'Prevents under-hood air stagnation.'
    },
    educationalFacts: [
      'An internal combustion engine converts only ~35% of fuel energy to brake horsepower; ~30% is lost to coolant, and ~35% out the exhaust pipe!',
      'Viscous fan clutches use shear-thickening silicone fluid to engage fan only when air temperature rises above 75°C.'
    ],
    failureSymptoms: [
      'Engine overheating in city traffic while running cool at highway cruising speeds.',
      'Fan blade fatigue cracking from debris strikes or vibration.'
    ],
    relatedComponentIds: ['alternator', 'engine_block', 'timing_drive'],
    meshNames: ['mesh_cooling_fan'],
    explosionVector: [0, 0, 1.5],
    canIsolate: true
  },
  {
    id: 'alternator',
    displayName: 'Alternator (Electrical Generator)',
    category: 'electrical',
    categoryName: 'Electrical Accessories',
    subsystem: 'Vehicle Electrical Generation',
    description: 'Belt-driven electromechanical generator that converts mechanical shaft power into 14V direct-current electrical power.',
    function: 'Powers ignition coils, fuel injectors, ECUs, sensors, and recharges vehicle 12V battery while engine runs.',
    workingPrinciple: 'Claw-pole rotor spun by serpentine belt creates rotating magnetic field, inducing 3-phase AC voltage in stator windings; rectified to DC via diode bridge.',
    location: 'Bolted to front accessory bracket on engine block flank.',
    material: 'Die-cast Aluminum housing, Copper stator windings, Neodymium / Ferrite magnets',
    operatingTemp: '90°C – 125°C',
    roleInCycle: {
      INTAKE: 'Supplies electrical energy for ECU and sensor ADC sampling.',
      COMPRESSION: 'Powers fuel pump delivering fuel rail pressure.',
      POWER: 'Supplies 30A current pulse to ignition coils for spark discharge.',
      EXHAUST: 'Continuous steady electrical supply.'
    },
    educationalFacts: [
      'Modern smart alternators decouple during hard vehicle acceleration to free up 3-5 horsepower!',
      'Internal solid-state voltage regulator adjusts rotor field current to maintain steady 14.2V across variable engine RPM.'
    ],
    failureSymptoms: [
      'Battery warning light on dashboard.',
      'Whining noise from worn rotor bearings.',
      'Blown rectifier diodes causing battery drain when vehicle is parked.'
    ],
    relatedComponentIds: ['cooling_fan', 'crankshaft', 'timing_drive'],
    meshNames: ['mesh_alternator'],
    explosionVector: [1.2, -0.2, 0.8],
    canIsolate: true
  },
  {
    id: 'oil_filter',
    displayName: 'Spin-On Oil Filter Assembly',
    category: 'lubrication',
    categoryName: 'Lubrication System',
    subsystem: 'Lubricant Filtration & Engine Protection',
    description: 'Canister filter with synthetic pleated cellulose media and anti-drainback silicone valve.',
    function: 'Removes metal wear shavings, soot, carbon particulates, and combustion debris from circulating engine oil.',
    workingPrinciple: 'Full-flow filtration: pressurized oil from pump enters peripheral holes, passes inward through pleated media, and exits center threaded stud to main oil gallery.',
    location: 'Threaded onto lower engine block flank near oil pump outlet.',
    material: 'Deep-drawn Steel canister, micro-glass synthetic media, nitrile/silicone seal',
    operatingTemp: '90°C – 130°C',
    tolerance: 'Filters particles down to 20 microns (ISO 4548-12 standard)',
    roleInCycle: {
      INTAKE: 'Maintains clean hydrodynamic oil film preventing metal-to-metal contact.',
      COMPRESSION: 'Lubricates piston skirt and cylinder wall interface.',
      POWER: 'Cools underside of piston crown via oil squirt jets.',
      EXHAUST: 'Lubricates turbocharger shaft bearings spinning at 150,000 RPM.'
    },
    educationalFacts: [
      'Includes an internal bypass spring valve that opens if filter media clogs, ensuring engine never starves for oil.',
      'Anti-drainback silicone valve prevents oil from emptying when engine shuts off, stopping dry cold-start clatter.'
    ],
    failureSymptoms: [
      'Filter bypass valve open causing unfiltered oil to circulate and accelerate bearing wear.',
      'Filter seal blowout from extreme cold oil pressure relief failure.'
    ],
    relatedComponentIds: ['oil_sump', 'engine_block', 'crankshaft'],
    meshNames: ['mesh_oil_filter'],
    explosionVector: [1.1, -0.6, 0.4],
    canIsolate: true
  },
  {
    id: 'intake_manifold',
    displayName: 'Intake Manifold Assembly',
    category: 'induction',
    categoryName: 'Fuel & Induction System',
    subsystem: 'Air Distribution Plenum',
    description: 'Plenum chamber with tuned runner tubes branching into each of the four cylinder intake ports.',
    function: 'Distributes filtered air evenly to all cylinders with minimal flow restriction and optimal velocity.',
    workingPrinciple: 'Helmholtz resonance tuning: runner length and volume are calculated so pressure waves reflect off closed valves, bouncing back to ram fresh air in just before valve closes.',
    location: 'Bolted to cylinder head intake side.',
    material: 'Glass-fiber filled Polyamide composite (Nylon 66) or Cast Aluminum',
    operatingTemp: '40°C – 80°C',
    roleInCycle: {
      INTAKE: 'Supplies high-velocity airflow into opening intake valve.',
      COMPRESSION: 'Pressure wave bounces back into runner plenum.',
      POWER: 'Refills plenum with fresh air charge through throttle body.',
      EXHAUST: 'Maintains plenum vacuum depression ready for next intake event.'
    },
    educationalFacts: [
      'Variable-length intake manifolds use internal butterfly flaps to switch between long runners (for low-RPM torque) and short runners (for high-RPM breathing).',
      'Smooth composite plastic runners have lower surface friction and lower thermal conductivity than metal castings.'
    ],
    failureSymptoms: [
      'Intake manifold gasket vacuum leaks causing lean codes and surging idle.',
      'Swirl flap actuator failure sticking runners in one position.'
    ],
    relatedComponentIds: ['cylinder_head', 'fuel_injector', 'intake_valve_1'],
    meshNames: ['mesh_intake_manifold'],
    explosionVector: [-1.4, 0.6, 0],
    canIsolate: true
  },
  {
    id: 'exhaust_manifold',
    displayName: 'Exhaust Manifold (4-into-1)',
    category: 'exhaust',
    categoryName: 'Exhaust System',
    subsystem: 'Exhaust Scavenging & Evacuation',
    description: 'Header casting with four curved runner tubes converging into a single collector connected to downpipe and catalytic converter.',
    function: 'Collects red-hot exhaust gases from all cylinders, preventing cylinder-to-cylinder back-pressure pulse interference.',
    workingPrinciple: 'Pulse scavenging: as exhaust pulse rushes down runner, it leaves a low-pressure rarefaction wave behind it that pulls remaining exhaust out of the cylinder during valve overlap.',
    location: 'Bolted to cylinder head exhaust flank.',
    material: 'Nodular Ductile Cast Iron (SiMo) or Tubular Stainless Steel 304',
    operatingTemp: '650°C – 950°C',
    roleInCycle: {
      INTAKE: 'Negative pressure wave aids cylinder scavenging during valve overlap.',
      COMPRESSION: 'Passive.',
      POWER: 'Passive.',
      EXHAUST: 'Channels supersonic 800°C sonic pulses toward catalytic converter.'
    },
    educationalFacts: [
      'Equal-length header tubes ensure each cylinder exhaust pulse arrives at the collector with identical timing.',
      'Insulated double-wall exhaust manifolds keep exhaust hot to light off catalytic converters within seconds of cold start.'
    ],
    failureSymptoms: [
      'Thermal fatigue cracks emitting ticking exhaust leak sounds when cold.',
      'Warped flange blowing manifold gasket and triggering oxygen sensor fault codes.'
    ],
    relatedComponentIds: ['cylinder_head', 'exhaust_valve_1'],
    meshNames: ['mesh_exhaust_manifold'],
    explosionVector: [1.4, 0.5, 0],
    canIsolate: true
  },
  {
    id: 'flywheel',
    displayName: 'Engine Flywheel (with Ring Gear)',
    category: 'rotating',
    categoryName: 'Rotating Assembly',
    subsystem: 'Rotational Inertia & Clutch Interface',
    description: 'Heavy precision-balanced cast steel disc with outer starter ring gear bolted to rear of crankshaft.',
    function: 'Stores kinetic rotational energy to carry the crankshaft smoothly between intermittent power pulses; provides friction surface for clutch.',
    workingPrinciple: 'High moment of inertia ($I = m \cdot r^2$) dampens crankshaft rotational speed fluctuations between power strokes.',
    location: 'Rear of crankshaft at bellhousing junction.',
    material: 'Nodular Cast Iron or Forged Chromoly Steel with induction-hardened ring teeth',
    operatingTemp: '60°C – 180°C (under clutch slip)',
    tolerance: 'Dynamic balance within 2.0 gram-centimeters',
    roleInCycle: {
      INTAKE: 'Supplies stored rotational inertia pushing piston through intake stroke.',
      COMPRESSION: 'Supplies rotational inertia driving compression against high cylinder pressure.',
      POWER: 'Absorbs acceleration surge from firing stroke, smoothing output torque.',
      EXHAUST: 'Supplies rotational momentum for exhaust stroke.'
    },
    educationalFacts: [
      'Dual-Mass Flywheels (DMF) use internal arc springs to absorb diesel/turbo vibration pulses before reaching transmission.',
      'Outer ring gear has teeth meshed by vehicle electric starter motor to crank engine during startup.'
    ],
    failureSymptoms: [
      'Clutch chatter from heat-checked or glazed flywheel friction face.',
      'Stripped ring gear teeth preventing starter motor engagement.'
    ],
    relatedComponentIds: ['crankshaft', 'engine_block'],
    meshNames: ['mesh_flywheel'],
    explosionVector: [0, 0, -1.3],
    canIsolate: true
  },
  {
    id: 'oil_sump',
    displayName: 'Oil Sump (Oil Pan)',
    category: 'lubrication',
    categoryName: 'Lubrication System',
    subsystem: 'Oil Reservoir & Cooling Pan',
    description: 'Stamped steel or cast aluminum reservoir bolted to the bottom of the engine block.',
    function: 'Stores engine oil reserve (typically 4–6 liters), cools returned oil, and houses the oil pump pickup strainer screen.',
    workingPrinciple: 'Wet sump lubrication: oil draining from cylinder head and bearings collects here, settles, cools by ambient air, and is suctioned by oil pump.',
    location: 'Lowest component of engine, bolted to bottom of engine block.',
    material: 'Cast Aluminum Alloy or Stamped Steel with anti-corrosion coating',
    operatingTemp: '85°C – 115°C',
    roleInCycle: {
      INTAKE: 'Maintains steady oil supply for pump pickup.',
      COMPRESSION: 'Collects oil scraped from cylinder walls by piston oil rings.',
      POWER: 'Collects oil sprayed on piston undersides.',
      EXHAUST: 'Cools circulating oil through aluminum fins or airflow.'
    },
    educationalFacts: [
      'Internal baffle plates and one-way trap doors keep oil submerged around pickup tube during hard vehicle cornering or braking.',
      'Cast aluminum pans add structural torsional stiffness to the entire engine block assembly.'
    ],
    failureSymptoms: [
      'Impact puncture from road debris leading to catastrophic oil loss and engine seizure.',
      'Stripped drain plug threads causing persistent oil dripping.'
    ],
    relatedComponentIds: ['engine_block', 'oil_filter', 'crankshaft'],
    meshNames: ['mesh_oil_sump'],
    explosionVector: [0, -1.2, 0],
    canIsolate: true
  },
  {
    id: 'timing_drive',
    displayName: 'Timing Drive (Belt / Pulleys)',
    category: 'valvetrain',
    categoryName: 'Valvetrain Assembly',
    subsystem: 'Synchronous Drive Mechanism',
    description: 'Toothed timing belt running between crankshaft sprocket and overhead camshaft pulleys with dynamic tensioner.',
    function: 'Maintains exact rotational synchronization between crankshaft and camshafts at precise 2:1 ratio.',
    workingPrinciple: 'Molded rubber teeth engage sprockets with zero slip, ensuring valves open and close at exact microsecond piston positions.',
    location: 'Front face of engine block and cylinder head behind timing cover.',
    material: 'HNBR synthetic rubber reinforced with fiberglass/aramid cords',
    operatingTemp: '-40°C – 130°C',
    roleInCycle: {
      INTAKE: 'Rotates camshaft synchronously with downward piston travel.',
      COMPRESSION: 'Rotates camshaft to keep valves sealed.',
      POWER: 'Maintains valve sealing throughout combustion.',
      EXHAUST: 'Rotates camshaft to actuate exhaust valve opening.'
    },
    educationalFacts: [
      'In an "interference engine," timing belt failure causes pistons to smash into open valves, destroying the engine!',
      'Hydraulic tensioners automatically compensate for thermal growth of the engine block as it heats up.'
    ],
    failureSymptoms: [
      'Belt tooth shear or snap causing immediate engine shutdown and bent valves.',
      'Worn tensioner pulley bearing producing high-pitch whining or rattling.'
    ],
    relatedComponentIds: ['crankshaft', 'camshaft', 'cooling_fan'],
    meshNames: ['mesh_timing_drive'],
    explosionVector: [0, 0, 1.1],
    canIsolate: true
  }
];

export const COMPONENT_CATEGORIES = [
  { id: 'all', name: 'All Components', count: ENGINE_COMPONENTS.length },
  { id: 'structure', name: 'Engine Block & Head', count: 3 },
  { id: 'reciprocating', name: 'Pistons & Rods', count: 5 },
  { id: 'rotating', name: 'Crankshaft & Flywheel', count: 2 },
  { id: 'valvetrain', name: 'Camshaft & Valvetrain', count: 4 },
  { id: 'induction', name: 'Fuel & Air System', count: 2 },
  { id: 'ignition', name: 'Ignition & Combustion', count: 2 },
  { id: 'cooling', name: 'Cooling System', count: 1 },
  { id: 'lubrication', name: 'Lubrication System', count: 2 },
  { id: 'exhaust', name: 'Exhaust System', count: 1 },
  { id: 'electrical', name: 'Electrical Accessories', count: 1 }
];
