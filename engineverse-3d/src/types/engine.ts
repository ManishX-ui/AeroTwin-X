export type ComponentCategory =
  | 'structure'
  | 'reciprocating'
  | 'rotating'
  | 'valvetrain'
  | 'induction'
  | 'ignition'
  | 'cooling'
  | 'lubrication'
  | 'exhaust'
  | 'electrical';

export type StrokePhase = 'INTAKE' | 'COMPRESSION' | 'POWER' | 'EXHAUST';

export type ViewPreset = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' | 'TOP' | 'ISOMETRIC';

export type RenderMode = 'METALLIC' | 'TRANSPARENT' | 'WIREFRAME' | 'SECTION';

export interface ComponentMetadata {
  id: string;
  displayName: string;
  category: ComponentCategory;
  categoryName: string;
  subsystem: string;
  description: string;
  function: string;
  workingPrinciple: string;
  location: string;
  material: string;
  operatingTemp?: string;
  tolerance?: string;
  roleInCycle: Record<StrokePhase, string>;
  educationalFacts: string[];
  failureSymptoms: string[];
  relatedComponentIds: string[];
  meshNames: string[];
  explosionVector: [number, number, number]; // [x, y, z] direction multiplier
  canIsolate: boolean;
}

export interface LearningStep {
  id: number;
  title: string;
  subtitle: string;
  focusComponentId: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  content: string;
  keyPoints: string[];
  technicalTrivia: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  componentId?: string;
}

export interface ModelNodeInfo {
  name: string;
  type: string;
  childrenCount: number;
  isMesh: boolean;
  geometryType?: string;
  vertexCount?: number;
  triangleCount?: number;
  materialName?: string;
}
