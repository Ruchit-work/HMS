// Thorax and abdomen: some of the lymph nodes (for 3D viewer)
// Model: thorax_and_abdomen_some_of_the_lymph_nodes — E-learning UMCG (@eLearningUMCG)
// Source: https://sketchfab.com/3d-models/thorax-and-abdomen-some-of-the-lymph-nodes-836b2a28b86c4e8e8596ab80e0584478
// License: CC Attribution-NonCommercial-NoDerivs. For imaging/anatomy education; created from CT data and anatomy references.
import { EarPartData } from './earDiseases'

export type LymphNodesPartData = EarPartData

export const lymphNodesPartsData: Record<string, LymphNodesPartData> = {
  Thoracic_Nodes: {
    partName: 'Thoracic lymph nodes',
    description: 'Lymph nodes in the chest (thorax) region — part of the thorax and abdomen lymph node model for imaging education.',
    diseases: []
  },
  Abdominal_Nodes: {
    partName: 'Abdominal lymph nodes',
    description: 'Lymph nodes in the abdomen — part of the thorax and abdomen lymph node model for imaging education.',
    diseases: []
  },
  Mediastinal: {
    partName: 'Mediastinal nodes',
    description: 'Nodes in the space between the lungs.',
    diseases: []
  },
  Mesenteric: {
    partName: 'Mesenteric nodes',
    description: 'Nodes along the intestines.',
    diseases: []
  },
  Liver: {
    partName: 'Liver',
    description: 'Large organ that filters blood and produces bile.',
    diseases: []
  },
  Spleen: {
    partName: 'Spleen',
    description: 'Organ that filters blood and supports immune function.',
    diseases: []
  },
  Pancreas: {
    partName: 'Pancreas',
    description: 'Gland that produces insulin and digestive enzymes.',
    diseases: []
  },
  Gallbladder: {
    partName: 'Gallbladder',
    description: 'Stores and concentrates bile from the liver.',
    diseases: []
  },
  Large_Intestine: {
    partName: 'Large Intestine',
    description: 'Absorbs water and forms feces.',
    diseases: []
  },
  Small_Intestine: {
    partName: 'Small Intestine',
    description: 'Where most digestion and nutrient absorption occurs.',
    diseases: []
  },
  Kidneys: {
    partName: 'Kidneys',
    description: 'Filter blood and produce urine.',
    diseases: []
  },
  Heart: {
    partName: 'Heart',
    description: 'Pumps blood through the circulatory system.',
    diseases: []
  },
  Bronchi: {
    partName: 'Bronchi',
    description: 'Airways leading from the trachea into the lungs.',
    diseases: []
  },
  Trachea: {
    partName: 'Trachea',
    description: 'Windpipe - carries air to the lungs.',
    diseases: []
  }
}
