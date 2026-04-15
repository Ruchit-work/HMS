/**
 * ENT anatomy mappings - object names, anatomical names, helpers
 */

export type AnatomyType =
  | 'ear'
  | 'nose'
  | 'throat'
  | 'dental'
  | 'lungs'
  | 'kidney'
  | 'skeleton'
  | 'lymph_nodes'
  | 'female_reproductive'

export const objectNameToPartMap: Record<string, string> = {
  'Object 1': 'Outer_Ear', 'Object 2': 'Ear_Canal', 'Object 3': 'Eardrum', 'Object 4': 'Ossicles', 'Object 5': 'Cochlea', 'Object 6': 'Semicircular_Canals', 'Object 7': 'Auditory_Nerve',
  'object 1': 'Outer_Ear', 'object 2': 'Ear_Canal', 'object 3': 'Eardrum', 'object 4': 'Ossicles', 'object 5': 'Cochlea', 'object 6': 'Semicircular_Canals', 'object 7': 'Auditory_Nerve',
  'Object_1': 'Outer_Ear', 'Object_2': 'Ear_Canal', 'Object_3': 'Eardrum', 'Object_4': 'Ossicles', 'Object_5': 'Cochlea', 'Object_6': 'Semicircular_Canals', 'Object_7': 'Auditory_Nerve',
  'Object_10': 'Outer_Ear', 'Object_11': 'Ear_Canal', 'Object_12': 'Eardrum', 'Object_13': 'Ossicles', 'Object_14': 'Cochlea', 'Object_15': 'Semicircular_Canals', 'Object_16': 'Auditory_Nerve',
  'object_10': 'Outer_Ear', 'object_11': 'Ear_Canal', 'object_12': 'Eardrum', 'object_13': 'Ossicles', 'object_14': 'Cochlea', 'object_15': 'Semicircular_Canals', 'object_16': 'Auditory_Nerve',
  'mesh_1': 'Outer_Ear', 'mesh_2': 'Ear_Canal', 'mesh_3': 'Eardrum', 'mesh_4': 'Ossicles', 'mesh_5': 'Cochlea', 'mesh_6': 'Semicircular_Canals', 'mesh_7': 'Auditory_Nerve',
  'Mesh_1': 'Outer_Ear', 'Mesh_2': 'Ear_Canal', 'Mesh_3': 'Eardrum', 'Mesh_4': 'Ossicles', 'Mesh_5': 'Cochlea', 'Mesh_6': 'Semicircular_Canals', 'Mesh_7': 'Auditory_Nerve',
}

export function getAnatomyTypeFromPath(modelPath: string): AnatomyType {
  if (modelPath.includes('reproduction') || modelPath.includes('reproductive') || modelPath.includes('pelvic')) return 'female_reproductive'
  if (modelPath.includes('skeleton') || modelPath.includes('bone') || modelPath.includes('skelton')) return 'skeleton'
  if (modelPath.includes('thorat') || modelPath.includes('throat') || modelPath.includes('larynx')) return 'throat'
  if (modelPath.includes('human_mouth_detailed') || modelPath.includes('mouth') || modelPath.includes('mandible') || modelPath.includes('dental')) return 'dental'
  if (modelPath.includes('nose') || modelPath.includes('hidung')) return 'nose'
  if (modelPath.includes('kidney') || modelPath.includes('renal')) return 'kidney'
  if (modelPath.includes('thorax_and_abdomen')) return 'lymph_nodes'
  if (modelPath.includes('lungs') || modelPath.includes('heart')) return 'lungs'
  if (modelPath.includes('ear')) return 'ear'
  return 'ear'
}

export function getObjectNumberMapping(anatomyType: AnatomyType): Record<number, string> {
  const mappings: Record<AnatomyType, Record<number, string>> = {
    nose: { 0: 'Nostrils', 1: 'Nostrils', 2: 'Nasal_Cavity', 3: 'Nasal_Septum', 4: 'Turbinates', 5: 'Sinuses', 6: 'Nasal_Cavity', 7: 'Sinuses', 8: 'Turbinates', 9: 'Nasal_Cavity', 10: 'Nostrils', 11: 'Sinuses', 12: 'Nasal_Septum', 13: 'Turbinates', 14: 'Nasal_Cavity', 15: 'Sinuses', 16: 'Nostrils', 17: 'Nasal_Septum', 18: 'Turbinates', 19: 'Nasal_Cavity', 20: 'Sinuses', 21: 'Nostrils', 22: 'Nasal_Septum', 23: 'Turbinates', 24: 'Nasal_Cavity' },
    lungs: {
      1: 'Left_Lung', 2: 'Right_Lung', 3: 'Left_Ventricle', 4: 'Right_Ventricle',
      5: 'Right_Atrium', 6: 'Left_Atrium', 7: 'Aorta', 8: 'Left_Pulmonary_Artery', 9: 'Right_Pulmonary_Artery',
      10: 'Superior_Caval_Vein', 11: 'Inferior_Caval_Vein', 12: 'Pulmonary_Trunk',
      13: 'Right_Pulmonary_Vein', 14: 'Left_Pulmonary_Vein', 15: 'Trachea', 16: 'Bronchi'
    },
    throat: { 1: 'Pharynx', 2: 'Larynx', 3: 'Epiglottis', 4: 'Trachea', 5: 'Vocal_Cords' },
    dental: { 1: 'Teeth', 2: 'Gums', 3: 'Tongue', 4: 'Mandible', 5: 'Palate', 6: 'Oral_Mucosa', 7: 'Salivary_Glands', 8: 'Wisdom_Teeth' },
    kidney: { 1: 'Kidney', 2: 'Renal_Pelvis', 3: 'Ureter', 4: 'Cortex', 5: 'Medulla' },
    ear: { 1: 'Outer_Ear', 2: 'Ear_Canal', 3: 'Eardrum', 4: 'Ossicles', 5: 'Cochlea', 6: 'Semicircular_Canals', 7: 'Auditory_Nerve', 10: 'Outer_Ear', 11: 'Ear_Canal', 12: 'Eardrum', 13: 'Ossicles', 14: 'Cochlea', 15: 'Semicircular_Canals', 16: 'Auditory_Nerve' },
    skeleton: { 1: 'Skull', 2: 'Spine', 3: 'Ribcage', 4: 'Pelvis', 5: 'Humerus', 6: 'Radius', 7: 'Ulna', 8: 'Femur', 9: 'Tibia', 10: 'Fibula', 11: 'Clavicle', 12: 'Scapula', 13: 'Sternum', 14: 'Patella' },
    lymph_nodes: {},
    female_reproductive: {},
  }
  return mappings[anatomyType] ?? mappings.ear
}

export const anatomicalNameToPartMap: Record<AnatomyType, Record<string, string>> = {
  throat: {
    Pharynx: 'Pharynx', Nasopharynx: 'Pharynx', Oropharynx: 'Pharynx', Laryngopharynx: 'Pharynx',
    Larynx: 'Larynx', Voice_Box: 'Larynx', Thyroid_Cartilage: 'Larynx', Cricoid_Cartilage: 'Larynx', Arytenoid_Cartilage: 'Larynx', Corniculate_Cartilage: 'Larynx', Cuneiform_Cartilage: 'Larynx',
    Epiglottis: 'Epiglottis',
    Vocal_Cord: 'Vocal_Cords', Vocal_Cords: 'Vocal_Cords', Vocal_Fold: 'Vocal_Cords', Vocal_Folds: 'Vocal_Cords', True_Vocal_Cord: 'Vocal_Cords', False_Vocal_Cord: 'Vocal_Cords', Glottis: 'Vocal_Cords',
    Trachea: 'Trachea', Windpipe: 'Trachea',
  },
  dental: {
    Teeth: 'Teeth', Tooth: 'Teeth', Tooth_1: 'Teeth', Tooth_2: 'Teeth', Tooth_3: 'Teeth', Tooth_4: 'Teeth', Tooth_5: 'Teeth', Tooth_6: 'Teeth', Tooth_7: 'Teeth', Tooth_8: 'Teeth',
    Upper_Teeth: 'Teeth', Lower_Teeth: 'Teeth', Upper_Tooth: 'Teeth', Lower_Tooth: 'Teeth', Incisor: 'Teeth', Incisor_1: 'Teeth', Incisor_2: 'Teeth', Canine: 'Teeth', Canine_1: 'Teeth',
    Premolar: 'Teeth', Premolar_1: 'Teeth', Premolar_2: 'Teeth', Molar: 'Teeth', Molar_1: 'Teeth', Molar_2: 'Teeth', Molar_3: 'Teeth',
    Third_Molar: 'Wisdom_Teeth', Wisdom_Tooth: 'Wisdom_Teeth', Wisdom_Teeth: 'Wisdom_Teeth', Third_Molars: 'Wisdom_Teeth',
    Gums: 'Gums', Gum: 'Gums', Gingiva: 'Gums', Gingival: 'Gums', Gingiva_Tissue: 'Gums', Gum_Tissue: 'Gums', Upper_Gums: 'Gums', Lower_Gums: 'Gums',
    Tongue: 'Tongue', Tongue_Muscle: 'Tongue', Tongue_Body: 'Tongue',
    Mandible: 'Mandible', Mandible_Bone: 'Mandible', Lower_Jaw: 'Mandible', Lower_Jaw_Bone: 'Mandible', Jaw: 'Mandible', Jaw_Bone: 'Mandible', Mandibular: 'Mandible', Mandibular_Bone: 'Mandible',
    Palate: 'Palate', Hard_Palate: 'Palate', Soft_Palate: 'Palate', Palate_Bone: 'Palate', Uvula: 'Palate',
    Oral_Mucosa: 'Oral_Mucosa', Mucosa: 'Oral_Mucosa', Oral_Mucous_Membrane: 'Oral_Mucosa', Lips: 'Oral_Mucosa', Lip: 'Oral_Mucosa', Upper_Lip: 'Oral_Mucosa', Lower_Lip: 'Oral_Mucosa', Cheek: 'Oral_Mucosa', Buccal_Mucosa: 'Oral_Mucosa',
    Salivary_Glands: 'Salivary_Glands', Salivary_Gland: 'Salivary_Glands', Parotid: 'Salivary_Glands', Submandibular: 'Salivary_Glands', Sublingual: 'Salivary_Glands',
    // human_mouth_detailed scene nodes/meshes
    mouth_0: 'Oral_Mucosa', teeth_1: 'Teeth', wet_2: 'Tongue',
    Object_0: 'Oral_Mucosa', Object_1: 'Teeth', Object_2: 'Tongue', Object_4: 'Oral_Mucosa', Object_6: 'Teeth', Object_8: 'Tongue',
  },
  lungs: {
    Left_Lung: 'Left_Lung', 'Left lung': 'Left_Lung', Left_lung: 'Left_Lung', LeftLung: 'Left_Lung', linkerlong: 'Left_Lung',
    Right_Lung: 'Right_Lung', 'Right lung': 'Right_Lung', Right_lung: 'Right_Lung', RightLung: 'Right_Lung', rechterlong: 'Right_Lung',
    Left_Ventricle: 'Left_Ventricle', 'Left ventricle': 'Left_Ventricle', Left_ventricle: 'Left_Ventricle',
    Right_Ventricle: 'Right_Ventricle', 'Right ventricle': 'Right_Ventricle', Right_ventricle: 'Right_Ventricle',
    Right_Atrium: 'Right_Atrium', 'Right atrium': 'Right_Atrium', Right_atrium: 'Right_Atrium',
    Left_Atrium: 'Left_Atrium', 'Left atrium': 'Left_Atrium', Left_atrium: 'Left_Atrium',
    Aorta: 'Aorta',
    Left_Pulmonary_Artery: 'Left_Pulmonary_Artery', 'Left pulmonary artery': 'Left_Pulmonary_Artery',
    Right_Pulmonary_Artery: 'Right_Pulmonary_Artery', 'Right pulmonary artery': 'Right_Pulmonary_Artery',
    Superior_Caval_Vein: 'Superior_Caval_Vein', 'Superior caval vein': 'Superior_Caval_Vein', Superior_Vena_Cava: 'Superior_Caval_Vein',
    Inferior_Caval_Vein: 'Inferior_Caval_Vein', 'Inferior caval vein': 'Inferior_Caval_Vein', Inferior_Vena_Cava: 'Inferior_Caval_Vein',
    Pulmonary_Trunk: 'Pulmonary_Trunk', 'Pulmonary trunk': 'Pulmonary_Trunk',
    Right_Pulmonary_Vein: 'Right_Pulmonary_Vein', 'Right pulmonary vein': 'Right_Pulmonary_Vein',
    Left_Pulmonary_Vein: 'Left_Pulmonary_Vein', 'Left pulmonary vein': 'Left_Pulmonary_Vein',
    Lungs: 'Left_Lung', Lung: 'Right_Lung',
    SM_Heart: 'Aorta', Heart_Mesh: 'Aorta', normaal4: 'Aorta', normaal5: 'Left_Lung', linkerlong3: 'Left_Lung', rechterlong3: 'Right_Lung',
  },
  kidney: {
    Kidney: 'Kidney', Left_Kidney: 'Kidney', Right_Kidney: 'Kidney', Renal_Pelvis: 'Renal_Pelvis', Ureter: 'Ureter', Cortex: 'Cortex', Medulla: 'Medulla', SM_Kidney: 'Kidney', SM_Ureter: 'Ureter',
  },
  nose: {
    Nostrils: 'Nostrils', Nasal_Vestibule: 'Nostrils', Nasal_Cavity: 'Nasal_Cavity', Nasal_Septum: 'Nasal_Septum', Septum: 'Nasal_Septum',
    Turbinates: 'Turbinates', Turbinate: 'Turbinates', Nasal_Conchae: 'Turbinates', Sinuses: 'Sinuses', Sinus: 'Sinuses', Paranasal_Sinuses: 'Sinuses',
  },
  ear: {},
  skeleton: {
    Skull: 'Skull', Cranium: 'Skull', Mandible: 'Skull', Jaw: 'Skull',
    Spine: 'Spine', Vertebrae: 'Spine', Cervical_Spine: 'Spine', Thoracic_Spine: 'Spine', Lumbar_Spine: 'Spine', Sacrum: 'Spine', Coccyx: 'Spine',
    Ribcage: 'Ribcage', Ribs: 'Ribcage', Rib: 'Ribcage', Sternum: 'Sternum',
    Pelvis: 'Pelvis', Hip: 'Pelvis', Ilium: 'Pelvis', Ischium: 'Pelvis', Pubis: 'Pelvis',
    Humerus: 'Humerus', Radius: 'Radius', Ulna: 'Ulna', Femur: 'Femur', Tibia: 'Tibia', Fibula: 'Fibula',
    Clavicle: 'Clavicle', Scapula: 'Scapula', Patella: 'Patella', Knee_Cap: 'Patella',
  },
  lymph_nodes: {
    // Dutch/original mesh names → real anatomical part names (thorax_and_abdomen_some_of_the_lymph_nodes model)
    Dikke_darms: 'Large_Intestine', Dunne_darms: 'Small_Intestine', 'Dikke_darms_Dikke_darms_0': 'Large_Intestine', 'Dunne_darms_Dunne_darms_0': 'Small_Intestine',
    Galblaas: 'Gallbladder', 'Galblaas_Galblaas_0': 'Gallbladder',
    Lever: 'Liver', 'Lever_Lever_0': 'Liver',
    Milt: 'Spleen', 'Milt_Milt_0': 'Spleen',
    Pancreas: 'Pancreas', 'Pancreas_Pancreas_0': 'Pancreas',
    Niertjes: 'Kidneys', 'Niertjes_Niertjes_0': 'Kidneys',
    PM3D_Sphere3D1: 'Thoracic_Nodes', 'PM3D_Sphere3D1_PM3D_Sphere3D1_0': 'Thoracic_Nodes',
    Bronchi: 'Bronchi', 'Bronchi_Bronchi_0': 'Bronchi',
    Htc: 'Abdominal_Nodes', 'Htc_Htc_0': 'Abdominal_Nodes',
    Kraakbeen_trache: 'Trachea', 'Kraakbeen_trache_Kraakbeen_trache_0': 'Trachea',
    Hart6: 'Heart', 'Hart6_Hart6_0': 'Heart', 'Hart6_Hart6_0_5': 'Heart', 'Hart6_Hart6_0_1': 'Heart', 'Hart6_Hart6_0_2': 'Heart', 'Hart6_Hart6_0_3': 'Heart', 'Hart6_Hart6_0_4': 'Heart',
    RootNode: 'Thoracic_Nodes', Sketchfab_model: 'Thoracic_Nodes',
  },
  female_reproductive: {
    Uterus: 'Uterus',
    Cervix: 'Cervix',
    Vagina: 'Vagina',
    Vulva: 'Vulva',
    Ovary: 'Ovary',
    Ovaries: 'Ovary',
    Bladder: 'Bladder',
    Rectum: 'Rectum',
    Pelvic_Bone: 'Pelvic_Bone',
    Bony_Pelvis: 'Pelvic_Bone',
    'Uterine tube': 'Uterine_Tube',
    'Fallopian tube': 'Uterine_Tube',
    'Fallopian Tube': 'Uterine_Tube',
    Endometrium: 'Endometrium',
    Myometrium: 'Myometrium',
    Fundus: 'Fundus',
    Fimbriae: 'Fimbriae',
    Infundibulum: 'Infundibulum',
  },
}
