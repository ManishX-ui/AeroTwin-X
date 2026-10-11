import { QuizQuestion } from '../types/engine';

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Which mechanical component converts the linear reciprocating motion of pistons into rotational torque?',
    options: [
      'Camshaft',
      'Crankshaft',
      'Connecting Rod',
      'Flywheel'
    ],
    correctIndex: 1,
    explanation: 'The crankshaft converts linear motion from the pistons into rotational motion. Connecting rods transmit the force, but the crankshaft offset crankpins produce the rotational torque.',
    componentId: 'crankshaft'
  },
  {
    id: 2,
    question: 'In a conventional four-stroke engine, what is the rotational speed ratio between the camshaft and the crankshaft?',
    options: [
      'Camshaft rotates at twice (2x) the speed of the crankshaft',
      'Camshaft rotates at identical (1:1) speed with the crankshaft',
      'Camshaft rotates at half (1:2) the speed of the crankshaft',
      'Camshaft rotates at one-fourth (1:4) the speed of the crankshaft'
    ],
    correctIndex: 2,
    explanation: 'Because a four-stroke cycle requires two full crankshaft revolutions (720°) to complete all four strokes, each valve opens once every 720°. Therefore, the camshaft must rotate at exactly half the crankshaft speed (1:2 ratio).',
    componentId: 'camshaft'
  },
  {
    id: 3,
    question: 'During which stroke of a four-stroke spark-ignition engine is the intake valve normally open?',
    options: [
      'Intake stroke',
      'Compression stroke',
      'Power stroke',
      'Exhaust stroke'
    ],
    correctIndex: 0,
    explanation: 'The intake valve opens during the intake stroke as the piston moves downward, allowing atmospheric or boosted air-fuel mixture to be drawn into the expanding cylinder volume.',
    componentId: 'intake_valve_1'
  },
  {
    id: 4,
    question: 'What is the primary operational purpose of the engine flywheel?',
    options: [
      'Pumping engine oil into the cylinder head',
      'Smoothing rotational speed fluctuations by storing kinetic momentum between power strokes',
      'Regulating the engine coolant operating temperature',
      'Generating high voltage for the spark plugs'
    ],
    correctIndex: 1,
    explanation: 'Because power is only produced during the power stroke, the engine requires stored kinetic energy to drive the pistons through intake, compression, and exhaust strokes. The heavy flywheel provides rotational inertia to smooth this delivery.',
    componentId: 'flywheel'
  },
  {
    id: 5,
    question: 'How many complete crankshaft revolutions occur during one complete four-stroke thermodynamic cycle?',
    options: [
      '1 revolution (360 degrees)',
      '2 revolutions (720 degrees)',
      '4 revolutions (1440 degrees)',
      '0.5 revolution (180 degrees)'
    ],
    correctIndex: 1,
    explanation: 'Each stroke (Intake, Compression, Power, Exhaust) corresponds to 180° of crankshaft rotation. 4 strokes × 180° = 720° of total rotation, which equals 2 full crankshaft revolutions.',
    componentId: 'crankshaft'
  },
  {
    id: 6,
    question: 'What is the primary function of the internal bypass valve inside an automotive spin-on oil filter?',
    options: [
      'To drain used engine oil during routine maintenance',
      'To route oil directly to bearings if the filter media becomes clogged, preventing catastrophic oil starvation',
      'To prevent motor oil from cooling down in winter',
      'To inject detergent additives into the oil stream'
    ],
    correctIndex: 1,
    explanation: 'Engine bearings will quickly seize if starved of oil. The spring-loaded bypass valve ensures that unfiltered oil continues circulating to bearings rather than stopping oil flow completely if the filter element clogs.',
    componentId: 'oil_filter'
  },
  {
    id: 7,
    question: 'Why are sodium-filled hollow valve stems frequently utilized in high-performance exhaust valves?',
    options: [
      'To reduce the electrical resistance of the valve',
      'To liquefy at operating temperature and conduct heat away from the glowing valve face to the valve guide',
      'To increase the total weight of the valvetrain',
      'To react with sulfur in combustion exhaust gas'
    ],
    correctIndex: 1,
    explanation: 'Metallic sodium melts at 98°C. During engine operation, the liquid sodium sloshes inside the hollow stem, conducting extreme combustion heat away from the valve head into the cylinder head cooling jackets.',
    componentId: 'exhaust_valve_1'
  },
  {
    id: 8,
    question: 'Which of the following describes the standard firing order for a typical inline-4 automobile engine?',
    options: [
      '1 - 2 - 3 - 4',
      '1 - 4 - 3 - 2',
      '1 - 3 - 4 - 2',
      '4 - 3 - 2 - 1'
    ],
    correctIndex: 2,
    explanation: '1 - 3 - 4 - 2 is the most common firing order for four-cylinder inline engines with flat-plane crankshafts, providing uniform 180° power intervals and optimal primary balance.',
    componentId: 'spark_plug_1'
  },
  {
    id: 9,
    question: 'What is the stoichiometric air-to-fuel ratio by mass for gasoline in a conventional spark-ignition engine?',
    options: [
      '9.7 : 1',
      '12.5 : 1',
      '14.7 : 1',
      '18.2 : 1'
    ],
    correctIndex: 2,
    explanation: 'The chemically ideal (stoichiometric) air-to-fuel ratio for complete combustion of standard gasoline is approximately 14.7 parts air to 1 part fuel by mass (Lambda = 1.0).',
    componentId: 'fuel_injector'
  },
  {
    id: 10,
    question: 'What mechanical failure occurs when a timing belt snaps on an "interference" engine design?',
    options: [
      'The alternator catches fire immediately',
      'The open valves remain in the cylinder path and are struck by the rising pistons, causing catastrophic damage',
      'The engine runs backwards in reverse gear',
      'The oil filter canister unscrews and drops off'
    ],
    correctIndex: 1,
    explanation: 'In an interference engine, the valve travel path overlaps with the piston top volume. If the timing belt snaps, the camshaft stops with some valves open, and rising pistons collide with them, bending valves and destroying piston crowns.',
    componentId: 'timing_drive'
  }
];
