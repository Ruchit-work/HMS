"use client"

import React, { useRef, useState, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// ENT anatomy part descriptions - focused on ear anatomy (fallback for known parts)
const entPartDescriptions: Record<string, { name: string; description: string }> = {
  // Ear parts - common mesh names in ear anatomy models
  Outer_Ear: {
    name: 'Outer Ear (Pinna/Auricle)',
    description: 'The visible external portion of the ear that collects sound waves and directs them into the ear canal. It also helps with sound localization and amplification of frequencies between 2-7 kHz. Common conditions: otitis externa, cauliflower ear, perichondritis.'
  },
  outer_ear: {
    name: 'Outer Ear (Pinna/Auricle)',
    description: 'The visible external portion of the ear that collects sound waves and directs them into the ear canal. It also helps with sound localization and amplification of frequencies between 2-7 kHz. Common conditions: otitis externa, cauliflower ear, perichondritis.'
  },
  Ear_Canal: {
    name: 'Ear Canal (External Auditory Canal)',
    description: 'A tube-like structure measuring approximately 2.5 cm that extends from the outer ear to the eardrum. It is lined with cerumen (earwax) glands and fine hairs that protect the ear from foreign particles and infections. Common conditions: otitis externa, cerumen impaction, foreign body.'
  },
  ear_canal: {
    name: 'Ear Canal (External Auditory Canal)',
    description: 'A tube-like structure measuring approximately 2.5 cm that extends from the outer ear to the eardrum. It is lined with cerumen (earwax) glands and fine hairs that protect the ear from foreign particles and infections. Common conditions: otitis externa, cerumen impaction, foreign body.'
  },
  Eardrum: {
    name: 'Eardrum (Tympanic Membrane)',
    description: 'A thin, cone-shaped membrane that separates the external ear from the middle ear. It vibrates in response to sound waves and transmits these vibrations to the ossicles. Acts as a protective barrier against infection. Common conditions: perforation, otitis media, tympanosclerosis.'
  },
  eardrum: {
    name: 'Eardrum (Tympanic Membrane)',
    description: 'A thin, cone-shaped membrane that separates the external ear from the middle ear. It vibrates in response to sound waves and transmits these vibrations to the ossicles. Acts as a protective barrier against infection. Common conditions: perforation, otitis media, tympanosclerosis.'
  },
  Ossicles: {
    name: 'Ossicles (Middle Ear Bones)',
    description: 'Three tiny bones (malleus, incus, stapes) that form a chain connecting the eardrum to the inner ear. They amplify sound vibrations by approximately 20-25 dB before transmitting them to the cochlea via the oval window. Common conditions: otosclerosis, ossicular chain dislocation, fixation.'
  },
  ossicles: {
    name: 'Ossicles (Middle Ear Bones)',
    description: 'Three tiny bones (malleus, incus, stapes) that form a chain connecting the eardrum to the inner ear. They amplify sound vibrations by approximately 20-25 dB before transmitting them to the cochlea via the oval window. Common conditions: otosclerosis, ossicular chain dislocation, fixation.'
  },
  Cochlea: {
    name: 'Cochlea',
    description: 'A spiral-shaped, fluid-filled organ in the inner ear responsible for converting sound vibrations into electrical signals. Contains approximately 15,000 hair cells that detect different frequencies along its length (tonotopic organization). Common conditions: sensorineural hearing loss, Ménière\'s disease, noise-induced hearing loss.'
  },
  cochlea: {
    name: 'Cochlea',
    description: 'A spiral-shaped, fluid-filled organ in the inner ear responsible for converting sound vibrations into electrical signals. Contains approximately 15,000 hair cells that detect different frequencies along its length (tonotopic organization). Common conditions: sensorineural hearing loss, Ménière\'s disease, noise-induced hearing loss.'
  },
  Semicircular_Canals: {
    name: 'Semicircular Canals',
    description: 'Three fluid-filled, looped tubes oriented at right angles to each other. Part of the vestibular system that detects rotational movements of the head and helps maintain balance and spatial orientation. Common conditions: benign paroxysmal positional vertigo (BPPV), labyrinthitis, vestibular neuritis.'
  },
  semicircular_canals: {
    name: 'Semicircular Canals',
    description: 'Three fluid-filled, looped tubes oriented at right angles to each other. Part of the vestibular system that detects rotational movements of the head and helps maintain balance and spatial orientation. Common conditions: benign paroxysmal positional vertigo (BPPV), labyrinthitis, vestibular neuritis.'
  },
  Auditory_Nerve: {
    name: 'Auditory Nerve (Cochlear Nerve)',
    description: 'The cranial nerve (CN VIII) that carries electrical signals from the cochlea to the brainstem and auditory cortex. Contains approximately 30,000 nerve fibers that transmit frequency-specific information for sound perception. Common conditions: acoustic neuroma, sensorineural hearing loss, neural presbycusis.'
  },
  auditory_nerve: {
    name: 'Auditory Nerve (Cochlear Nerve)',
    description: 'The cranial nerve (CN VIII) that carries electrical signals from the cochlea to the brainstem and auditory cortex. Contains approximately 30,000 nerve fibers that transmit frequency-specific information for sound perception. Common conditions: acoustic neuroma, sensorineural hearing loss, neural presbycusis.'
  },
  // Generic ear name fallbacks
  Ear: {
    name: 'Ear',
    description: 'The complete hearing and balance organ. Includes the outer ear, middle ear, and inner ear structures responsible for sound perception and equilibrium.'
  },
  ear: {
    name: 'Ear',
    description: 'The complete hearing and balance organ. Includes the outer ear, middle ear, and inner ear structures responsible for sound perception and equilibrium.'
  },
  // Throat parts
  Pharynx: {
    name: 'Pharynx',
    description: 'The muscular tube that connects the nasal cavity and mouth to the larynx and esophagus. Common conditions: pharyngitis, tonsillitis.'
  },
  pharynx: {
    name: 'Pharynx',
    description: 'The muscular tube that connects the nasal cavity and mouth to the larynx and esophagus. Common conditions: pharyngitis, tonsillitis.'
  },
  Larynx: {
    name: 'Larynx (Voice Box)',
    description: 'The organ in the neck that contains the vocal cords and is responsible for voice production and protecting the airway during swallowing. Common conditions: laryngitis, vocal cord polyps.'
  },
  larynx: {
    name: 'Larynx (Voice Box)',
    description: 'The organ in the neck that contains the vocal cords and is responsible for voice production and protecting the airway during swallowing. Common conditions: laryngitis, vocal cord polyps.'
  },
  Epiglottis: {
    name: 'Epiglottis',
    description: 'A leaf-shaped flap of cartilage that covers the larynx during swallowing to prevent food from entering the airway. Common conditions: epiglottitis (medical emergency).'
  },
  epiglottis: {
    name: 'Epiglottis',
    description: 'A leaf-shaped flap of cartilage that covers the larynx during swallowing to prevent food from entering the airway. Common conditions: epiglottitis (medical emergency).'
  },
  Trachea: {
    name: 'Trachea (Windpipe)',
    description: 'The tube that connects the larynx to the bronchi, allowing air to pass to and from the lungs. Common conditions: tracheitis, tracheal stenosis.'
  },
  trachea: {
    name: 'Trachea (Windpipe)',
    description: 'The tube that connects the larynx to the bronchi, allowing air to pass to and from the lungs. Common conditions: tracheitis, tracheal stenosis.'
  },
  Vocal_Cords: {
    name: 'Vocal Cords',
    description: 'Two bands of muscle tissue in the larynx that vibrate to produce sound when air passes through. Common conditions: vocal cord nodules, vocal cord paralysis.'
  },
  vocal_cords: {
    name: 'Vocal Cords',
    description: 'Two bands of muscle tissue in the larynx that vibrate to produce sound when air passes through. Common conditions: vocal cord nodules, vocal cord paralysis.'
  },
  // Dental parts
  Teeth: {
    name: 'Teeth (Dentition)',
    description: 'Hard, calcified structures in the mouth used for biting and chewing food. Each tooth consists of enamel, dentin, pulp, and cementum.'
  },
  teeth: {
    name: 'Teeth (Dentition)',
    description: 'Hard, calcified structures in the mouth used for biting and chewing food. Each tooth consists of enamel, dentin, pulp, and cementum.'
  },
  Gums: {
    name: 'Gums (Gingiva)',
    description: 'The soft tissue that surrounds and supports the teeth, protecting the underlying bone and tooth roots.'
  },
  gums: {
    name: 'Gums (Gingiva)',
    description: 'The soft tissue that surrounds and supports the teeth, protecting the underlying bone and tooth roots.'
  },
  Tongue: {
    name: 'Tongue',
    description: 'A muscular organ in the mouth responsible for taste, speech, swallowing, and oral hygiene.'
  },
  tongue: {
    name: 'Tongue',
    description: 'A muscular organ in the mouth responsible for taste, speech, swallowing, and oral hygiene.'
  },
  Mandible: {
    name: 'Mandible (Lower Jaw)',
    description: 'The largest and strongest bone of the face, forming the lower jaw and supporting the lower teeth.'
  },
  mandible: {
    name: 'Mandible (Lower Jaw)',
    description: 'The largest and strongest bone of the face, forming the lower jaw and supporting the lower teeth.'
  },
  Palate: {
    name: 'Palate (Roof of Mouth)',
    description: 'The roof of the mouth, consisting of the hard palate (anterior) and soft palate (posterior), separating oral and nasal cavities.'
  },
  palate: {
    name: 'Palate (Roof of Mouth)',
    description: 'The roof of the mouth, consisting of the hard palate (anterior) and soft palate (posterior), separating oral and nasal cavities.'
  },
  Oral_Mucosa: {
    name: 'Oral Mucosa',
    description: 'The mucous membrane lining the inside of the mouth, including cheeks, lips, floor of mouth, and palate.'
  },
  oral_mucosa: {
    name: 'Oral Mucosa',
    description: 'The mucous membrane lining the inside of the mouth, including cheeks, lips, floor of mouth, and palate.'
  },
  Salivary_Glands: {
    name: 'Salivary Glands',
    description: 'Glands that produce saliva, including parotid, submandibular, and sublingual glands, essential for digestion and oral health.'
  },
  salivary_glands: {
    name: 'Salivary Glands',
    description: 'Glands that produce saliva, including parotid, submandibular, and sublingual glands, essential for digestion and oral health.'
  },
  Wisdom_Teeth: {
    name: 'Wisdom Teeth (Third Molars)',
    description: 'The last molars to erupt, typically appearing in late teens or early twenties, often causing problems due to lack of space.'
  },
  wisdom_teeth: {
    name: 'Wisdom Teeth (Third Molars)',
    description: 'The last molars to erupt, typically appearing in late teens or early twenties, often causing problems due to lack of space.'
  }
}

// Generic part descriptions - works with any mesh name (Object 1, Object 2, etc.)
function getPartDescription(partName: string): { name: string; description: string } {
  // If we have a specific description, use it
  if (entPartDescriptions[partName]) {
    return entPartDescriptions[partName]
  }
  
  // Check case-insensitive match
  const lowerName = partName.toLowerCase()
  for (const key in entPartDescriptions) {
    if (key.toLowerCase() === lowerName) {
      return entPartDescriptions[key]
    }
  }
  
  // For generic names like "Object 1", "Object 2", etc., return generic description
  return {
    name: partName,
    description: `Selected part: ${partName}. Click to view detailed information and related conditions.`
  }
}

interface ENTAnatomyViewerProps {
  modelPath?: string
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  className?: string
  selectedPart?: string | null
}

// Mapping from generic object names to real ear part names
const objectNameToPartMap: Record<string, string> = {
  // Object with spaces
  'Object 1': 'Outer_Ear',
  'Object 2': 'Ear_Canal',
  'Object 3': 'Eardrum',
  'Object 4': 'Ossicles',
  'Object 5': 'Cochlea',
  'Object 6': 'Semicircular_Canals',
  'Object 7': 'Auditory_Nerve',
  'object 1': 'Outer_Ear',
  'object 2': 'Ear_Canal',
  'object 3': 'Eardrum',
  'object 4': 'Ossicles',
  'object 5': 'Cochlea',
  'object 6': 'Semicircular_Canals',
  'object 7': 'Auditory_Nerve',
  // Object with underscores (Object_1, Object_10, etc.)
  'Object_1': 'Outer_Ear',
  'Object_2': 'Ear_Canal',
  'Object_3': 'Eardrum',
  'Object_4': 'Ossicles',
  'Object_5': 'Cochlea',
  'Object_6': 'Semicircular_Canals',
  'Object_7': 'Auditory_Nerve',
  'Object_10': 'Outer_Ear',
  'Object_11': 'Ear_Canal',
  'Object_12': 'Eardrum',
  'Object_13': 'Ossicles',
  'Object_14': 'Cochlea',
  'Object_15': 'Semicircular_Canals',
  'Object_16': 'Auditory_Nerve',
  'object_1': 'Outer_Ear',
  'object_2': 'Ear_Canal',
  'object_3': 'Eardrum',
  'object_4': 'Ossicles',
  'object_5': 'Cochlea',
  'object_6': 'Semicircular_Canals',
  'object_7': 'Auditory_Nerve',
  'object_10': 'Outer_Ear',
  'object_11': 'Ear_Canal',
  'object_12': 'Eardrum',
  'object_13': 'Ossicles',
  'object_14': 'Cochlea',
  'object_15': 'Semicircular_Canals',
  'object_16': 'Auditory_Nerve',
  // Additional common variations
  'mesh_1': 'Outer_Ear',
  'mesh_2': 'Ear_Canal',
  'mesh_3': 'Eardrum',
  'mesh_4': 'Ossicles',
  'mesh_5': 'Cochlea',
  'mesh_6': 'Semicircular_Canals',
  'mesh_7': 'Auditory_Nerve',
  'Mesh_1': 'Outer_Ear',
  'Mesh_2': 'Ear_Canal',
  'Mesh_3': 'Eardrum',
  'Mesh_4': 'Ossicles',
  'Mesh_5': 'Cochlea',
  'Mesh_6': 'Semicircular_Canals',
  'Mesh_7': 'Auditory_Nerve',
}

// Helper function to determine anatomy type from model path
function getAnatomyTypeFromPath(modelPath: string): 'ear' | 'throat' | 'dental' {
  if (modelPath.includes('thorat') || modelPath.includes('throat') || modelPath.includes('larynx')) return 'throat'
  if (modelPath.includes('mouth') || modelPath.includes('mandible') || modelPath.includes('dental')) return 'dental'
  return 'ear' // default to ear
}

// Helper function to get object number to part mapping based on anatomy type
function getObjectNumberMapping(anatomyType: 'ear' | 'throat' | 'dental'): Record<number, string> {
  switch (anatomyType) {
    case 'throat':
      return {
        1: 'Pharynx',
        2: 'Larynx',
        3: 'Epiglottis',
        4: 'Trachea',
        5: 'Vocal_Cords',
      }
    case 'dental':
      return {
        1: 'Teeth',
        2: 'Gums',
        3: 'Tongue',
        4: 'Mandible',
        5: 'Palate',
        6: 'Oral_Mucosa',
        7: 'Salivary_Glands',
        8: 'Wisdom_Teeth',
      }
    case 'ear':
    default:
      return {
        1: 'Outer_Ear',
        2: 'Ear_Canal',
        3: 'Eardrum',
        4: 'Ossicles',
        5: 'Cochlea',
        6: 'Semicircular_Canals',
        7: 'Auditory_Nerve',
        10: 'Outer_Ear',
        11: 'Ear_Canal',
        12: 'Eardrum',
        13: 'Ossicles',
        14: 'Cochlea',
        15: 'Semicircular_Canals',
        16: 'Auditory_Nerve',
      }
  }
}

// Mapping from real anatomical names to standardized part names
const anatomicalNameToPartMap: Record<string, Record<string, string>> = {
  throat: {
    // Pharynx
    'Pharynx': 'Pharynx',
    'Nasopharynx': 'Pharynx',
    'Oropharynx': 'Pharynx',
    'Laryngopharynx': 'Pharynx',
    // Larynx
    'Larynx': 'Larynx',
    'Voice_Box': 'Larynx',
    'Thyroid_Cartilage': 'Larynx',
    'Cricoid_Cartilage': 'Larynx',
    'Arytenoid_Cartilage': 'Larynx',
    'Corniculate_Cartilage': 'Larynx',
    'Cuneiform_Cartilage': 'Larynx',
    // Epiglottis
    'Epiglottis': 'Epiglottis',
    // Vocal cords
    'Vocal_Cord': 'Vocal_Cords',
    'Vocal_Cords': 'Vocal_Cords',
    'Vocal_Fold': 'Vocal_Cords',
    'Vocal_Folds': 'Vocal_Cords',
    'True_Vocal_Cord': 'Vocal_Cords',
    'False_Vocal_Cord': 'Vocal_Cords',
    'Glottis': 'Vocal_Cords',
    // Trachea
    'Trachea': 'Trachea',
    'Windpipe': 'Trachea',
  },
  dental: {
    // Teeth variations
    'Teeth': 'Teeth',
    'Tooth': 'Teeth',
    'Tooth_1': 'Teeth',
    'Tooth_2': 'Teeth',
    'Tooth_3': 'Teeth',
    'Tooth_4': 'Teeth',
    'Tooth_5': 'Teeth',
    'Tooth_6': 'Teeth',
    'Tooth_7': 'Teeth',
    'Tooth_8': 'Teeth',
    'Upper_Teeth': 'Teeth',
    'Lower_Teeth': 'Teeth',
    'Upper_Tooth': 'Teeth',
    'Lower_Tooth': 'Teeth',
    'Incisor': 'Teeth',
    'Incisor_1': 'Teeth',
    'Incisor_2': 'Teeth',
    'Canine': 'Teeth',
    'Canine_1': 'Teeth',
    'Premolar': 'Teeth',
    'Premolar_1': 'Teeth',
    'Premolar_2': 'Teeth',
    'Molar': 'Teeth',
    'Molar_1': 'Teeth',
    'Molar_2': 'Teeth',
    'Molar_3': 'Teeth',
    'Third_Molar': 'Wisdom_Teeth',
    'Wisdom_Tooth': 'Wisdom_Teeth',
    'Wisdom_Teeth': 'Wisdom_Teeth',
    'Third_Molars': 'Wisdom_Teeth',
    // Gums variations
    'Gums': 'Gums',
    'Gum': 'Gums',
    'Gingiva': 'Gums',
    'Gingival': 'Gums',
    'Gingiva_Tissue': 'Gums',
    'Gum_Tissue': 'Gums',
    'Upper_Gums': 'Gums',
    'Lower_Gums': 'Gums',
    // Tongue variations
    'Tongue': 'Tongue',
    'Tongue_Muscle': 'Tongue',
    'Tongue_Body': 'Tongue',
    // Mandible variations
    'Mandible': 'Mandible',
    'Mandible_Bone': 'Mandible',
    'Lower_Jaw': 'Mandible',
    'Lower_Jaw_Bone': 'Mandible',
    'Jaw': 'Mandible',
    'Jaw_Bone': 'Mandible',
    'Mandibular': 'Mandible',
    'Mandibular_Bone': 'Mandible',
    // Palate variations
    'Palate': 'Palate',
    'Hard_Palate': 'Palate',
    'Soft_Palate': 'Palate',
    'Palate_Bone': 'Palate',
    'Uvula': 'Palate',
    // Oral Mucosa variations
    'Oral_Mucosa': 'Oral_Mucosa',
    'Mucosa': 'Oral_Mucosa',
    'Oral_Mucous_Membrane': 'Oral_Mucosa',
    'Lips': 'Oral_Mucosa',
    'Lip': 'Oral_Mucosa',
    'Upper_Lip': 'Oral_Mucosa',
    'Lower_Lip': 'Oral_Mucosa',
    'Cheek': 'Oral_Mucosa',
    'Buccal_Mucosa': 'Oral_Mucosa',
    // Salivary Glands variations
    'Salivary_Glands': 'Salivary_Glands',
    'Salivary_Gland': 'Salivary_Glands',
    'Parotid': 'Salivary_Glands',
    'Submandibular': 'Salivary_Glands',
    'Sublingual': 'Salivary_Glands',
  },
  ear: {}
}

// Helper function to get all names from object hierarchy for debugging
function getObjectHierarchyNames(object: THREE.Object3D): string[] {
  const names: string[] = []
  let current: THREE.Object3D | null = object
  let depth = 0
  while (current && depth < 5) {
    if (current.name && current.name.trim()) {
      names.push(current.name.trim())
    }
    current = current.parent
    depth++
  }
  return names
}

// Helper function to find part name from mesh name - maps generic names to real part names
function findPartName(object: THREE.Object3D, modelPath: string = '/models/ear/ear-anatomy.glb'): string | null {
  const anatomyType = getAnatomyTypeFromPath(modelPath)
  const objectNumberMapping = getObjectNumberMapping(anatomyType)
  let partName: string | null = null
  
  // Check if object has a name
  if (object.name && object.name.trim() !== '') {
    const objectName = object.name.trim()
    
    // First, check if it's a real anatomical name (exact match)
    if (anatomicalNameToPartMap[anatomyType] && anatomicalNameToPartMap[anatomyType][objectName]) {
      partName = anatomicalNameToPartMap[anatomyType][objectName]
    }
    // Check case-insensitive match for anatomical names (only if map has entries)
    else if (anatomicalNameToPartMap[anatomyType] && Object.keys(anatomicalNameToPartMap[anatomyType]).length > 0) {
      const lowerName = objectName.toLowerCase()
      for (const [anatomicalName, mappedPart] of Object.entries(anatomicalNameToPartMap[anatomyType])) {
        if (anatomicalName.toLowerCase() === lowerName) {
          partName = mappedPart
          break
        }
      }
    }
    
    // If no anatomical name match found, check generic mappings
    if (!partName) {
      // Check if it's a mapped generic name (exact match) - only for ear (legacy)
      if (anatomyType === 'ear' && objectNameToPartMap[objectName]) {
        partName = objectNameToPartMap[objectName]
      } 
      // Try to extract number from Object_X or Object X format and map it
      else {
        const objectMatch = objectName.match(/^[Oo]bject[_ ]?(\d+)$/i)
        if (objectMatch) {
          const objectNumber = parseInt(objectMatch[1], 10)
          if (objectNumberMapping[objectNumber]) {
            partName = objectNumberMapping[objectNumber]
          }
        }
      }
    }
    
    // If still no mapping found, check if it's already a real part name
    if (!partName && entPartDescriptions[objectName]) {
      partName = objectName
    } 
    // Try case-insensitive match for known parts
    else if (!partName) {
      const lowerName = objectName.toLowerCase()
      for (const key in entPartDescriptions) {
        if (key.toLowerCase() === lowerName) {
          partName = key
          break
        }
      }
    }
    
    // If still no match, try to find any pattern that might indicate a part
    if (!partName) {
      const lowerName = objectName.toLowerCase()
      
      if (anatomyType === 'throat') {
        // Throat part patterns - using real anatomical terms
        if (lowerName.includes('pharynx') || lowerName.includes('nasopharynx') || lowerName.includes('oropharynx') ||
            lowerName.includes('laryngopharynx')) {
          partName = 'Pharynx'
        } else if (lowerName.includes('larynx') || lowerName.includes('voice box') || lowerName.includes('thyroid cartilage') ||
                   lowerName.includes('cricoid') || lowerName.includes('arytenoid') || lowerName.includes('corniculate') ||
                   lowerName.includes('cuneiform')) {
          partName = 'Larynx'
        } else if (lowerName.includes('epiglottis')) {
          partName = 'Epiglottis'
        } else if (lowerName.includes('trachea') || lowerName.includes('windpipe')) {
          partName = 'Trachea'
        } else if (lowerName.includes('vocal') || lowerName.includes('cord') || lowerName.includes('fold') || 
                   lowerName.includes('glottis')) {
          partName = 'Vocal_Cords'
        } else if (lowerName.includes('throat')) {
          partName = 'Pharynx'
        }
      } else if (anatomyType === 'dental') {
        // Dental part patterns - prioritize more specific matches first
        const name = objectName.toLowerCase()
        
        // Wisdom teeth / Third molars (check first before general teeth)
        if (name.includes('wisdom') || name.includes('third_molar') || name.includes('third molar') || 
            name.includes('third-molar') || (name.includes('molar') && (name.includes('3') || name.includes('third') || name.includes('8')))) {
          partName = 'Wisdom_Teeth'
        }
        // Teeth - PRIORITY: Check for tooth/teeth patterns FIRST (MUST be explicit)
        // Check for exact matches or patterns that clearly indicate teeth
        // This must come BEFORE tongue check to avoid false matches
        if (name === 'tooth' || name === 'teeth' || 
            name.startsWith('tooth_') || name.startsWith('teeth_') ||
            name.startsWith('tooth ') || name.startsWith('teeth ') || 
            name.endsWith('_tooth') || name.endsWith('_teeth') ||
            name.includes('_tooth_') || name.includes('_teeth_') ||
            name.includes(' tooth ') || name.includes(' teeth ') ||
            name.includes('incisor') || name.includes('canine') || 
            (name.includes('premolar') && !name.includes('tongue')) || 
            (name.includes('molar') && !name.includes('tongue') && !name.includes('third') && !name.includes('wisdom')) ||
            (name.includes('dental') && !name.includes('tongue')) || 
            (name.includes('dentition') && !name.includes('tongue')) ||
            // Check for numbered teeth patterns - these are strong indicators
            /tooth[_\s-]?\d+/i.test(objectName) || /teeth[_\s-]?\d+/i.test(objectName) ||
            /upper[_\s-]?tooth/i.test(objectName) || /lower[_\s-]?tooth/i.test(objectName) ||
            /upper[_\s-]?teeth/i.test(objectName) || /lower[_\s-]?teeth/i.test(objectName) ||
            /^t[_\s-]?\d+/i.test(objectName) || /^d[_\s-]?\d+/i.test(objectName)) {
          partName = 'Teeth'
        }
        // Gums/Gingiva (check before tongue to avoid false matches)
        else if (name.includes('gum') || name.includes('gingiva') || name.includes('gingival') ||
                 name.includes('gums') || name.startsWith('gum_') || name.startsWith('gingiva')) {
          partName = 'Gums'
        }
        // Tongue (be more specific to avoid false matches)
        else if ((name === 'tongue' || name.startsWith('tongue_') || name.startsWith('tongue ') ||
                 name.includes('_tongue') || name.includes(' tongue') || name.includes('tongue ')) &&
                 !name.includes('tooth') && !name.includes('teeth')) {
          partName = 'Tongue'
        }
        // Mandible/Jaw
        else if (name.includes('mandible') || name.includes('mandibular') || 
                 (name.includes('jaw') && !name.includes('upper') && !name.includes('tongue'))) {
          partName = 'Mandible'
        }
        // Palate
        else if (name.includes('palate') || name.includes('palatal') || name.includes('uvula')) {
          partName = 'Palate'
        }
        // Oral Mucosa (lips, cheeks, mucosa)
        else if (name.includes('mucosa') || name.includes('mucous') || 
                 (name.includes('lip') && !name.includes('tongue')) || 
                 name.includes('cheek') || name.includes('buccal')) {
          partName = 'Oral_Mucosa'
        }
        // Salivary Glands
        else if (name.includes('salivary') || name.includes('parotid') || 
                 name.includes('submandibular') || name.includes('sublingual')) {
          partName = 'Salivary_Glands'
        }
        // Default fallback for dental models - if it's clearly a dental part but not matched
        else if (name.length > 0 && !name.includes('bone') && !name.includes('mesh') && 
                 !name.includes('object') && !name.includes('group') && !name.includes('root') &&
                 !name.includes('scene') && !name.includes('default')) {
          // Try to infer from context - if it's a number or seems like a tooth identifier
          if (/^\d+$/.test(name) || /^tooth\d+/i.test(objectName) || /^teeth\d+/i.test(objectName)) {
            partName = 'Teeth'
          }
        }
      } else {
        // Ear part patterns (original logic)
        if (lowerName.includes('outer') || lowerName.includes('pinna') || lowerName.includes('auricle')) {
          partName = 'Outer_Ear'
        } else if (lowerName.includes('canal') && lowerName.includes('ear')) {
          partName = 'Ear_Canal'
        } else if (lowerName.includes('drum') || lowerName.includes('tympanic') || lowerName.includes('membrane')) {
          partName = 'Eardrum'
        } else if (lowerName.includes('ossicle') || lowerName.includes('malleus') || lowerName.includes('incus') || lowerName.includes('stapes')) {
          partName = 'Ossicles'
        } else if (lowerName.includes('cochlea')) {
          partName = 'Cochlea'
        } else if (lowerName.includes('semicircular') || lowerName.includes('canal')) {
          partName = 'Semicircular_Canals'
        } else if (lowerName.includes('nerve') || lowerName.includes('auditory')) {
          partName = 'Auditory_Nerve'
        } else if (lowerName.includes('ear')) {
          partName = 'Outer_Ear'
        }
      }
    }
  }
  
  // If no name on object, check parent hierarchy
  if (!partName) {
    let current = object.parent
    let depth = 0
    while (current && depth < 5) { // Limit depth to avoid infinite loops
      if (current.name && current.name.trim() !== '') {
        const parentName = current.name.trim()
        
        // Try mapping parent name (only for ear legacy mapping)
        if (anatomyType === 'ear' && objectNameToPartMap[parentName]) {
          partName = objectNameToPartMap[parentName]
          break
        } else if (entPartDescriptions[parentName]) {
          partName = parentName
          break
        }
        
        // Try pattern matching on parent name
        const lowerParentName = parentName.toLowerCase()
        
        if (anatomyType === 'throat') {
          if (lowerParentName.includes('pharynx')) {
            partName = 'Pharynx'
            break
          } else if (lowerParentName.includes('larynx') || lowerParentName.includes('voice box')) {
            partName = 'Larynx'
            break
          } else if (lowerParentName.includes('epiglottis')) {
            partName = 'Epiglottis'
            break
          } else if (lowerParentName.includes('trachea') || lowerParentName.includes('windpipe')) {
            partName = 'Trachea'
            break
          } else if (lowerParentName.includes('vocal') || lowerParentName.includes('cord')) {
            partName = 'Vocal_Cords'
            break
          }
        } else if (anatomyType === 'dental') {
          // Wisdom teeth first
          if (lowerParentName.includes('wisdom') || lowerParentName.includes('third_molar') || 
              lowerParentName.includes('third molar')) {
            partName = 'Wisdom_Teeth'
            break
          }
          // Teeth
          else if (lowerParentName.includes('tooth') || lowerParentName.includes('teeth') || 
                   lowerParentName.includes('incisor') || lowerParentName.includes('canine') ||
                   lowerParentName.includes('premolar') || lowerParentName.includes('molar') ||
                   lowerParentName.includes('dental')) {
            partName = 'Teeth'
            break
          }
          // Gums
          else if (lowerParentName.includes('gum') || lowerParentName.includes('gingiva')) {
            partName = 'Gums'
            break
          }
          // Tongue
          else if (lowerParentName.includes('tongue') || lowerParentName.includes('lingual')) {
            partName = 'Tongue'
            break
          }
          // Mandible
          else if (lowerParentName.includes('mandible') || lowerParentName.includes('mandibular') ||
                   (lowerParentName.includes('jaw') && !lowerParentName.includes('upper'))) {
            partName = 'Mandible'
            break
          }
          // Palate
          else if (lowerParentName.includes('palate') || lowerParentName.includes('uvula')) {
            partName = 'Palate'
            break
          }
          // Oral Mucosa
          else if (lowerParentName.includes('mucosa') || lowerParentName.includes('lip') ||
                   lowerParentName.includes('cheek') || lowerParentName.includes('buccal')) {
            partName = 'Oral_Mucosa'
            break
          }
          // Salivary Glands
          else if (lowerParentName.includes('salivary') || lowerParentName.includes('parotid') ||
                   lowerParentName.includes('submandibular') || lowerParentName.includes('sublingual')) {
            partName = 'Salivary_Glands'
            break
          }
        } else {
          // Ear patterns
          if (lowerParentName.includes('outer') || lowerParentName.includes('pinna') || lowerParentName.includes('auricle')) {
            partName = 'Outer_Ear'
            break
          } else if (lowerParentName.includes('canal') && lowerParentName.includes('ear')) {
            partName = 'Ear_Canal'
            break
          } else if (lowerParentName.includes('drum') || lowerParentName.includes('tympanic')) {
            partName = 'Eardrum'
            break
          } else if (lowerParentName.includes('ossicle')) {
            partName = 'Ossicles'
            break
          } else if (lowerParentName.includes('cochlea')) {
            partName = 'Cochlea'
            break
          } else if (lowerParentName.includes('semicircular')) {
            partName = 'Semicircular_Canals'
            break
          } else if (lowerParentName.includes('nerve') || lowerParentName.includes('auditory')) {
            partName = 'Auditory_Nerve'
            break
          }
        }
      }
      current = current.parent
      depth++
    }
  }
  
  // If still no name found, return null instead of generating a UUID-based name
  // This will prevent showing "Part_xxxxx" and instead show a generic message
  return partName
}

function ENTModel({ onPartSelect, selectedPart: externalSelectedPart, modelPath = '/models/ear/ear-anatomy.glb' }: { 
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart?: string | null
  modelPath?: string
}) {
  const { scene } = useGLTF(modelPath)
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group | null>(null)
  const { gl, camera, raycaster, scene: r3fScene } = useThree()
  const isDraggingRef = useRef(false)
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const initializedRef = useRef(false)
  
  // Sync external selection
  React.useEffect(() => {
    if (externalSelectedPart !== undefined) {
      setSelectedPart(externalSelectedPart)
    }
  }, [externalSelectedPart])
  
  // Center, scale model and setup camera
  React.useEffect(() => {
    if (!scene || initializedRef.current) return
    
    // Clone the scene
    const clonedScene = scene.clone()
    
    // Calculate bounding box and center the model
    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    
    // First, center the model at origin by translating it
    clonedScene.position.x = -center.x
    clonedScene.position.y = -center.y
    clonedScene.position.z = -center.z
    
    // Scale the model to fit nicely - optimal size for medical viewing
    const scale = 3.5 / maxDim // Optimized scale for professional viewing
    clonedScene.scale.set(scale, scale, scale)
    
    // Recalculate bounding box after scaling to get accurate size and center
    const scaledBox = new THREE.Box3().setFromObject(clonedScene)
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
    const scaledSize = scaledBox.getSize(new THREE.Vector3())
    const scaledMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z)
    
    // Re-center the model after scaling to ensure it's perfectly centered at origin
    clonedScene.position.x -= scaledCenter.x
    clonedScene.position.y -= scaledCenter.y
    clonedScene.position.z -= scaledCenter.z
    
    // Store the cloned scene in modelRef
    modelRef.current = clonedScene
    
    // Calculate optimal camera distance to perfectly frame the model
    // Use FOV to calculate the distance needed to fit the model with proper padding
    const fov = 45 // Field of view in degrees
    const fovRad = (fov * Math.PI) / 180
    // Calculate distance to fit the model with 30% padding for professional framing
    const idealDistance = (scaledMaxDim / 2) / Math.tan(fovRad / 2) * 1.3
    
    // Store the ideal distance and model size for OrbitControls constraints
    clonedScene.userData.idealDistance = idealDistance
    clonedScene.userData.modelSize = scaledMaxDim
    
    // Also store on the groupRef for easy access
    if (groupRef.current) {
      groupRef.current.userData.idealDistance = idealDistance
      groupRef.current.userData.modelSize = scaledMaxDim
    }
    
    // Position camera to perfectly frame the model - ensure model is centered in view
    const safeDistance = Math.max(idealDistance, scaledMaxDim * 1.5, 4) // Minimum distance of 4
    
    // Position camera looking at the origin (where the model center should be)
    camera.position.set(0, 0, safeDistance)
    camera.lookAt(0, 0, 0)
    
    // Set camera near and far planes for optimal rendering
    camera.near = 0.1
    camera.far = 1000
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    // Store original materials and ensure meshes are interactive
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = Array.isArray(child.material) ? child.material[0] : child.material
        if (material instanceof THREE.MeshStandardMaterial) {
          child.userData.originalColor = material.color.clone()
          child.userData.originalEmissive = material.emissive.clone()
          child.castShadow = true
          child.receiveShadow = true
        }
        // Ensure mesh can receive pointer events
        child.userData.isInteractive = true
      }
    })
    
    initializedRef.current = true
  }, [scene, camera])

  // Handle hover using useFrame
  useFrame(({ pointer }) => {
    if (!groupRef.current || !modelRef.current || isDraggingRef.current) return

    raycaster.setFromCamera(pointer, camera)
    // Try intersecting with the model directly first, then fallback to group
    let intersects = raycaster.intersectObject(modelRef.current, true)
    if (intersects.length === 0 && groupRef.current) {
      intersects = raycaster.intersectObject(groupRef.current, true)
    }

    let newHoveredPart: string | null = null

    if (intersects.length > 0) {
      const intersected = intersects[0].object as THREE.Mesh
      const partName = findPartName(intersected, modelPath)
      if (partName) {
        newHoveredPart = partName
      }
    }

    if (newHoveredPart !== hoveredPart) {
      // Reset previous hover
      if (hoveredPart && hoveredPart !== selectedPart && modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const childPartName = findPartName(child, modelPath)
            if (childPartName === hoveredPart) {
              const material = Array.isArray(child.material) ? child.material[0] : child.material
              if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                material.color.copy(child.userData.originalColor)
                material.emissive.copy(child.userData.originalEmissive)
                material.emissiveIntensity = 0
              }
            }
          }
        })
      }

      setHoveredPart(newHoveredPart)

      // Apply hover highlight
      if (newHoveredPart && newHoveredPart !== selectedPart && modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const childPartName = findPartName(child, modelPath)
            if (childPartName === newHoveredPart) {
              const material = Array.isArray(child.material) ? child.material[0] : child.material
              if (material instanceof THREE.MeshStandardMaterial) {
                const originalColor = child.userData.originalColor || new THREE.Color(0.8, 0.8, 0.8)
                material.color.copy(originalColor).multiplyScalar(1.3)
                material.emissive.setHex(0x333333)
                material.emissiveIntensity = 0.15
              }
            }
          }
        })
      }

      gl.domElement.style.cursor = newHoveredPart ? 'pointer' : 'default'
    }
  })

  // Handle pointer down to detect drag vs click
  const handlePointerDown = React.useCallback((event: any) => {
    if (event.button !== 0) return // Only left mouse button
    
    // React Three Fiber events have different structure - try multiple sources
    const clientX = event.clientX ?? (event.nativeEvent?.clientX ?? (event.offsetX ? event.offsetX + (gl.domElement.getBoundingClientRect().left) : 0))
    const clientY = event.clientY ?? (event.nativeEvent?.clientY ?? (event.offsetY ? event.offsetY + (gl.domElement.getBoundingClientRect().top) : 0))
    
    pointerDownRef.current = {
      x: clientX,
      y: clientY,
      time: Date.now()
    }
    isDraggingRef.current = false
    // Don't stop propagation here - allow OrbitControls to work for rotation
  }, [gl])

  // Handle pointer move to detect dragging
  const handlePointerMove = React.useCallback((event: any) => {
    if (pointerDownRef.current) {
      const clientX = event.clientX ?? (event.nativeEvent?.clientX ?? (event.offsetX ? event.offsetX + (gl.domElement.getBoundingClientRect().left) : 0))
      const clientY = event.clientY ?? (event.nativeEvent?.clientY ?? (event.offsetY ? event.offsetY + (gl.domElement.getBoundingClientRect().top) : 0))
      const dx = Math.abs(clientX - pointerDownRef.current.x)
      const dy = Math.abs(clientY - pointerDownRef.current.y)
      if (dx > 5 || dy > 5) {
        isDraggingRef.current = true
      }
    }
    // Don't stop propagation here - allow OrbitControls to work for rotation
  }, [gl])

  // Handle pointer up to detect clicks (not drags)
  const handlePointerUp = React.useCallback((event: any) => {
    if (event.button !== 0 || !pointerDownRef.current) {
      pointerDownRef.current = null
      isDraggingRef.current = false
      return
    }
    
    // React Three Fiber events - try to get coordinates from multiple sources
    const rect = gl.domElement.getBoundingClientRect()
    const clientX = event.clientX ?? event.nativeEvent?.clientX ?? (event.offsetX ? event.offsetX + rect.left : 0)
    const clientY = event.clientY ?? event.nativeEvent?.clientY ?? (event.offsetY ? event.offsetY + rect.top : 0)
    
    const dt = Date.now() - pointerDownRef.current.time
    const dx = Math.abs(clientX - pointerDownRef.current.x)
    const dy = Math.abs(clientY - pointerDownRef.current.y)
    
    // Only treat as click if it was quick (< 300ms) and no significant movement (< 5px)
    if (dt < 300 && dx < 5 && dy < 5 && !isDraggingRef.current) {
      // Stop event propagation to prevent OrbitControls from interfering with clicks
      event.stopPropagation()
      // Perform click action
      if (!groupRef.current || !modelRef.current) {
        pointerDownRef.current = null
        return
      }

      // Use raycasting to find clicked object
      const mouse = new THREE.Vector2()
      const rect = gl.domElement.getBoundingClientRect()
      // Use the actual client coordinates
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      // Intersect with the model directly - this should work since modelRef.current is the cloned scene
      const intersects = raycaster.intersectObject(modelRef.current, true)

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object as THREE.Mesh
        const partName = findPartName(clickedObject, modelPath)

        // Only proceed if we have a valid part name (not null and not a UUID-based fallback)
        if (partName && !partName.startsWith('Part_') && modelRef.current) {
          // Reset previous selection
          if (selectedPart) {
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const childPartName = findPartName(child, modelPath)
                if (childPartName === selectedPart) {
                  const material = Array.isArray(child.material) ? child.material[0] : child.material
                  if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                    material.color.copy(child.userData.originalColor)
                    material.emissive.copy(child.userData.originalEmissive)
                    material.emissiveIntensity = 0
                  }
                }
              }
            })
          }

          // Toggle selection
          const newSelectedPart = selectedPart === partName ? null : partName
          setSelectedPart(newSelectedPart)

          // Apply selection highlight
          if (newSelectedPart) {
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const childPartName = findPartName(child, modelPath)
                if (childPartName === newSelectedPart) {
                  const material = Array.isArray(child.material) ? child.material[0] : child.material
                  if (material instanceof THREE.MeshStandardMaterial) {
                    material.color.setHex(0x4ade80) // Green highlight
                    material.emissive.setHex(0x22c55e)
                    material.emissiveIntensity = 0.4
                  }
                }
              }
            })
          }

          // Only proceed if we have a valid part name (not a UUID-based fallback like "Part_xxxxx")
          if (newSelectedPart && !newSelectedPart.startsWith('Part_')) {
            const partInfo = getPartDescription(newSelectedPart)
            onPartSelect?.(newSelectedPart, partInfo)
          } else {
            // Log warning for debugging - object couldn't be identified

          }
        }
      } else {
        // Click on empty space - deselect
        if (selectedPart && modelRef.current) {
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const childPartName = findPartName(child, modelPath)
              if (childPartName === selectedPart) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material
                if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  material.color.copy(child.userData.originalColor)
                  material.emissive.copy(child.userData.originalEmissive)
                  material.emissiveIntensity = 0
                }
              }
            }
          })
          setSelectedPart(null)
          onPartSelect?.(null, undefined)
        }
      }
    }
    
    pointerDownRef.current = null
    isDraggingRef.current = false
  }, [selectedPart, camera, raycaster, onPartSelect, gl])

  // Handle click directly (simpler approach) - MUST be before conditional return
  const handleClick = React.useCallback((event: any) => {
    if (!groupRef.current || !modelRef.current) {
      return
    }

    // Stop event propagation to prevent OrbitControls from interfering
    event.stopPropagation()
    
    // Use raycasting to find clicked object
    const mouse = new THREE.Vector2()
    const rect = gl.domElement.getBoundingClientRect()
    
    // Get coordinates from the event
    const clientX = event.clientX ?? (event.nativeEvent?.clientX ?? 0)
    const clientY = event.clientY ?? (event.nativeEvent?.clientY ?? 0)
    
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObject(modelRef.current, true)

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object as THREE.Mesh
      const partName = findPartName(clickedObject, modelPath)

      // Only proceed if we have a valid part name (not null and not a UUID-based fallback)
      if (partName && !partName.startsWith('Part_') && modelRef.current) {
        // Reset previous selection
        if (selectedPart) {
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const childPartName = findPartName(child, modelPath)
              if (childPartName === selectedPart) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material
                if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  material.color.copy(child.userData.originalColor)
                  material.emissive.copy(child.userData.originalEmissive)
                  material.emissiveIntensity = 0
                }
              }
            }
          })
        }

        // Toggle selection
        const newSelectedPart = selectedPart === partName ? null : partName
        setSelectedPart(newSelectedPart)

        // Apply selection highlight
        if (newSelectedPart) {
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const childPartName = findPartName(child, modelPath)
              if (childPartName === newSelectedPart) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material
                if (material instanceof THREE.MeshStandardMaterial) {
                  material.color.setHex(0x4ade80) // Green highlight
                  material.emissive.setHex(0x22c55e)
                  material.emissiveIntensity = 0.4
                }
              }
            }
          })
        }

        // Only proceed if we have a valid part name (not a UUID-based fallback like "Part_xxxxx")
        if (newSelectedPart && !newSelectedPart.startsWith('Part_')) {
          const partInfo = getPartDescription(newSelectedPart)
          onPartSelect?.(newSelectedPart, partInfo)
        } else {
          // Log warning for debugging - object couldn't be identified

        }
      }
    } else {
      // Click on empty space - deselect
      if (selectedPart && modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const childPartName = findPartName(child, modelPath)
            if (childPartName === selectedPart) {
              const material = Array.isArray(child.material) ? child.material[0] : child.material
              if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                material.color.copy(child.userData.originalColor)
                material.emissive.copy(child.userData.originalEmissive)
                material.emissiveIntensity = 0
              }
            }
          }
        })
        setSelectedPart(null)
        onPartSelect?.(null, undefined)
      }
    }
  }, [selectedPart, camera, raycaster, onPartSelect, gl, modelPath])

  if (!scene || !modelRef.current) return null

  return (
    <group 
      ref={groupRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <primitive object={modelRef.current} />
    </group>
  )
}

function ENTScene({ onPartSelect, selectedPart, modelPath }: { 
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart?: string | null
  modelPath?: string
}) {
  const controlsRef = useRef<any>(null)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.5} />
      <pointLight position={[0, 10, 0]} intensity={0.4} />

      <ENTModel onPartSelect={onPartSelect} selectedPart={selectedPart} modelPath={modelPath} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.1}
        rotateSpeed={0.5}
        target={[0, 0, 0]}
        autoRotate={false}
        screenSpacePanning={false}
        touches={{
          ONE: 2 // Rotate only
        }}
      />
    </>
  )
}

export default function ENTAnatomyViewer({ 
  modelPath = '/models/ear/ear-anatomy.glb',
  onPartSelect, 
  className = '',
  selectedPart 
}: ENTAnatomyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`} 
      style={{ touchAction: 'none' }}
    >
      <div className="w-full max-w-2xl h-full max-h-[600px] mx-auto">
        <Canvas
          className="w-full h-full"
          shadows
        gl={{ 
          antialias: true, 
          alpha: true, 
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 1000 }}
        frameloop="always"
      >
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} near={0.1} far={1000} />
        <color attach="background" args={['#f8fafc']} />
        <Suspense fallback={null}>
          <ENTScene onPartSelect={onPartSelect} selectedPart={selectedPart} modelPath={modelPath} />
        </Suspense>
      </Canvas>
      </div>
    </div>
  )
}

// Preload the model
if (typeof window !== 'undefined') {
  useGLTF.preload('/models/ear/ear-anatomy.glb')
}
