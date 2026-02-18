// Skeleton anatomy parts with associated diseases, symptoms, prescriptions, and medicines
import type { Disease } from './earDiseases'

export interface SkeletonPartData {
  partName: string
  description: string
  diseases: Disease[]
}

export const skeletonPartsData: Record<string, SkeletonPartData> = {
  Skull: {
    partName: 'Skull',
    description: 'Bony structure that protects the brain and supports the face.',
    diseases: [
      {
        id: 'skull_fracture',
        name: 'Skull Fracture',
        description: 'Break in one or more bones of the skull, often due to head trauma.',
        symptoms: ['Head pain', 'Swelling', 'Bruising', 'Nausea', 'Confusion', 'Loss of consciousness'],
        prescriptions: ['Rest', 'Avoid contact sports', 'Monitor for neurological changes', 'CT/MRI if indicated'],
        medicines: [
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '5-7 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' },
        ],
        notes: 'Refer to neurosurgery if open or depressed fracture. Rule out concussion.',
      },
    ],
  },
  Spine: {
    partName: 'Spine (Vertebral Column)',
    description: 'Column of vertebrae protecting the spinal cord.',
    diseases: [
      {
        id: 'lumbar_strain',
        name: 'Lumbar Strain / Lower Back Pain',
        description: 'Injury or overuse of muscles and ligaments in the lower back.',
        symptoms: ['Lower back pain', 'Stiffness', 'Muscle spasms', 'Reduced range of motion'],
        prescriptions: ['Rest', 'Ice/heat therapy', 'Avoid heavy lifting', 'Physical therapy'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Cyclobenzaprine', dosage: '5-10mg', frequency: 'At bedtime', duration: '5-7 days' },
        ],
        notes: 'If radiculopathy or red flags, consider imaging and referral.',
      },
      {
        id: 'disc_herniation',
        name: 'Disc Herniation',
        description: 'Bulging or rupture of an intervertebral disc pressing on nerves.',
        symptoms: ['Back pain', 'Leg pain (sciatica)', 'Numbness', 'Weakness', 'Tingling'],
        prescriptions: ['Relative rest', 'Physical therapy', 'Epidural injection if indicated', 'Avoid prolonged sitting'],
        medicines: [
          { name: 'Naproxen', dosage: '500mg', frequency: 'Twice daily', duration: '10-14 days' },
          { name: 'Pregabalin', dosage: '75mg', frequency: 'Twice daily', duration: 'As needed' },
        ],
        notes: 'Surgical referral if progressive weakness, cauda equina, or failed conservative care.',
      },
    ],
  },
  Ribcage: {
    partName: 'Ribcage',
    description: 'Bony cage formed by ribs and sternum protecting thoracic organs.',
    diseases: [
      {
        id: 'rib_fracture',
        name: 'Rib Fracture',
        description: 'Break in one or more ribs, usually from trauma or cough.',
        symptoms: ['Chest wall pain', 'Pain on breathing', 'Tenderness', 'Bruising'],
        prescriptions: ['Pain control', 'Deep breathing exercises', 'Avoid strenuous activity', 'No binding'],
        medicines: [
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
        ],
        notes: 'Rule out pneumothorax. Multiple fractures may need surgical opinion.',
      },
    ],
  },
  Sternum: {
    partName: 'Sternum (Breastbone)',
    description: 'Flat bone in the center of the chest connecting the ribs.',
    diseases: [
      {
        id: 'costochondritis',
        name: 'Costochondritis',
        description: 'Inflammation of the cartilage connecting ribs to sternum.',
        symptoms: ['Chest pain', 'Tenderness over sternum', 'Pain on movement or deep breath'],
        prescriptions: ['Rest', 'Avoid heavy lifting', 'Heat therapy', 'Posture correction'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Naproxen', dosage: '500mg', frequency: 'Twice daily', duration: '7-10 days' },
        ],
        notes: 'Exclude cardiac cause when appropriate. Usually self-limiting.',
      },
    ],
  },
  Pelvis: {
    partName: 'Pelvis',
    description: 'Bony structure connecting the spine to the lower limbs.',
    diseases: [
      {
        id: 'pelvic_fracture',
        name: 'Pelvic Fracture',
        description: 'Break in the pelvic ring, often from high-energy trauma.',
        symptoms: ['Pelvic pain', 'Unable to bear weight', 'Swelling', 'Bruising', 'Instability'],
        prescriptions: ['Strict rest', 'No weight bearing', 'Stabilization', 'Surgical evaluation'],
        medicines: [
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: 'As needed' },
          { name: 'Tramadol', dosage: '50mg', frequency: 'Every 6 hours', duration: 'Short term' },
        ],
        notes: 'High-energy fractures need trauma/ortho referral. Rule out visceral injury.',
      },
    ],
  },
  Humerus: {
    partName: 'Humerus (Upper Arm)',
    description: 'Bone connecting shoulder to elbow.',
    diseases: [
      {
        id: 'humerus_fracture',
        name: 'Humerus Fracture',
        description: 'Break in the upper arm bone, from fall or direct trauma.',
        symptoms: ['Arm pain', 'Swelling', 'Bruising', 'Deformity', 'Limited movement'],
        prescriptions: ['Sling immobilization', 'Ice', 'Avoid lifting', 'Follow-up X-ray'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-14 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-14 days' },
        ],
        notes: 'Proximal and shaft fractures often managed non-op. Distal may need ortho referral.',
      },
    ],
  },
  Femur: {
    partName: 'Femur (Thigh Bone)',
    description: 'Longest bone in the body, connecting hip to knee.',
    diseases: [
      {
        id: 'femur_fracture',
        name: 'Femur Fracture',
        description: 'Break in the thigh bone, often from high-energy trauma or osteoporosis.',
        symptoms: ['Severe thigh pain', 'Unable to bear weight', 'Shortening/rotation of leg', 'Swelling'],
        prescriptions: ['Emergency evaluation', 'Splinting', 'NPO if surgery planned', 'DVT prophylaxis'],
        medicines: [
          { name: 'Morphine or equivalent', dosage: 'Per protocol', frequency: 'As needed', duration: 'Pre-op' },
          { name: 'Enoxaparin', dosage: '40mg', frequency: 'Once daily', duration: 'As per protocol' },
        ],
        notes: 'Usually requires surgical fixation. Ortho referral. Consider osteoporosis workup in elderly.',
      },
    ],
  },
  Tibia: {
    partName: 'Tibia (Shin Bone)',
    description: 'Larger of the two lower leg bones.',
    diseases: [
      {
        id: 'tibia_fracture',
        name: 'Tibia Fracture',
        description: 'Break in the shin bone, from trauma or stress.',
        symptoms: ['Leg pain', 'Swelling', 'Unable to bear weight', 'Deformity'],
        prescriptions: ['Splint/cast', 'No weight bearing', 'Ice', 'Elevation'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
        ],
        notes: 'Open or unstable fractures need ortho. Stress fractures: rest and gradual return.',
      },
    ],
  },
  Patella: {
    partName: 'Patella (Kneecap)',
    description: 'Small bone protecting the knee joint.',
    diseases: [
      {
        id: 'patella_fracture',
        name: 'Patella Fracture',
        description: 'Break in the kneecap, from direct blow or quadriceps pull.',
        symptoms: ['Knee pain', 'Swelling', 'Unable to extend knee', 'Tenderness'],
        prescriptions: ['Knee immobilizer', 'No weight bearing', 'Ice', 'Ortho follow-up'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
        ],
        notes: 'Displaced or open fractures typically need surgery. Preserve extensor mechanism.',
      },
    ],
  },
  Clavicle: {
    partName: 'Clavicle (Collarbone)',
    description: 'Bone connecting sternum to shoulder.',
    diseases: [
      {
        id: 'clavicle_fracture',
        name: 'Clavicle Fracture',
        description: 'Break in the collarbone, common in falls and sports.',
        symptoms: ['Shoulder/collarbone pain', 'Swelling', 'Deformity', 'Limited arm movement'],
        prescriptions: ['Sling', 'Ice', 'Avoid overhead activity', 'Serial X-rays'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-14 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-14 days' },
        ],
        notes: 'Most midshaft fractures heal with sling. Displaced/distal may need surgical referral.',
      },
    ],
  },
  Radius: {
    partName: 'Radius (Forearm)',
    description: 'One of two forearm bones (thumb side).',
    diseases: [
      {
        id: 'colles_fracture',
        name: 'Colles Fracture (Distal Radius)',
        description: 'Break of the radius near the wrist, often from fall on outstretched hand.',
        symptoms: ['Wrist pain', 'Swelling', 'Dinner-fork deformity', 'Limited motion'],
        prescriptions: ['Reduction if displaced', 'Cast/splint', 'Elevation', 'Follow-up X-ray'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
        ],
        notes: 'Unstable or intra-articular may need surgical fixation.',
      },
    ],
  },
  Ulna: {
    partName: 'Ulna (Forearm)',
    description: 'One of two forearm bones (pinky side).',
    diseases: [
      {
        id: 'ulna_fracture',
        name: 'Ulna Fracture',
        description: 'Break in the ulna, often with radius (both-bone forearm fracture).',
        symptoms: ['Forearm pain', 'Swelling', 'Deformity', 'Limited rotation'],
        prescriptions: ['Splint/cast', 'No weight bearing', 'Ice', 'Ortho referral if displaced'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
        ],
        notes: 'Isolated ulna (nightstick) may be cast. Both-bone often need ORIF.',
      },
    ],
  },
  Fibula: {
    partName: 'Fibula',
    description: 'Thinner lower leg bone alongside the tibia.',
    diseases: [
      {
        id: 'fibula_fracture',
        name: 'Fibula Fracture',
        description: 'Break in the fibula, often with ankle injury or tibia fracture.',
        symptoms: ['Ankle/lower leg pain', 'Swelling', 'Bruising', 'Difficulty bearing weight'],
        prescriptions: ['Splint/brace', 'Rest', 'Ice', 'Elevation', 'Weight bearing as tolerated if isolated'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
        ],
        notes: 'Isolated fibula shaft often stable. Ankle syndesmosis injury needs surgical consideration.',
      },
    ],
  },
  Scapula: {
    partName: 'Scapula (Shoulder Blade)',
    description: 'Flat triangular bone at the back of the shoulder.',
    diseases: [
      {
        id: 'scapula_fracture',
        name: 'Scapula Fracture',
        description: 'Break in the shoulder blade, usually from high-energy trauma.',
        symptoms: ['Shoulder/back pain', 'Swelling', 'Pain with arm movement', 'Tenderness'],
        prescriptions: ['Sling', 'Rest', 'Ice', 'Early motion when pain allows', 'Trauma workup'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-14 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-14 days' },
        ],
        notes: 'Rule out associated chest/ vascular injury. Many treated non-operatively.',
      },
    ],
  },
  Radius_Ulna: {
    partName: 'Radius & Ulna',
    description: 'Forearm bones (radius on thumb side, ulna on pinky side).',
    diseases: [
      {
        id: 'forearm_fracture',
        name: 'Forearm Fracture',
        description: 'Break in one or both forearm bones.',
        symptoms: ['Pain', 'Swelling', 'Deformity', 'Limited rotation'],
        prescriptions: ['Splint/cast', 'Rest', 'Follow-up X-ray', 'Physical therapy when healed'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-10 days' },
        ],
        notes: 'Both-bone fractures often need surgical fixation.',
      },
    ],
  },
  Tarsals: {
    partName: 'Tarsals',
    description: 'Bones of the ankle and rear foot.',
    diseases: [
      {
        id: 'ankle_fracture',
        name: 'Ankle / Tarsal Fracture',
        description: 'Break in ankle or foot bones.',
        symptoms: ['Pain', 'Swelling', 'Difficulty bearing weight', 'Bruising'],
        prescriptions: ['Rest', 'Ice', 'Elevation', 'Splint/cast or surgery as indicated'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-14 days' },
        ],
        notes: 'Assess stability; some require ORIF.',
      },
    ],
  },
  Tibia_Fibula: {
    partName: 'Tibia & Fibula',
    description: 'Lower leg bones (tibia is the shin bone, fibula is the thinner lateral bone).',
    diseases: [
      {
        id: 'tibia_fibula_fracture',
        name: 'Tibia/Fibula Fracture',
        description: 'Break in one or both lower leg bones.',
        symptoms: ['Pain', 'Swelling', 'Deformity', 'Unable to bear weight'],
        prescriptions: ['Splint', 'Rest', 'X-ray', 'Ortho referral for many'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-14 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '7-14 days' },
        ],
        notes: 'Open or unstable fractures need urgent referral.',
      },
    ],
  },
  Hand: {
    partName: 'Hand',
    description: 'Bones and joints of the hand (carpals, metacarpals, phalanges).',
    diseases: [
      {
        id: 'hand_fracture',
        name: 'Hand / Metacarpal Fracture',
        description: 'Break in hand bones.',
        symptoms: ['Pain', 'Swelling', 'Bruising', 'Deformity'],
        prescriptions: ['Splint', 'Rest', 'X-ray', 'Hand therapy when indicated'],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
        ],
        notes: 'Boxer’s fracture and other patterns may need reduction or fixation.',
      },
    ],
  },
  Mandible: {
    partName: 'Mandible (Lower Jaw)',
    description:
      'The mandible is the largest and strongest bone of the face. It forms the lower jaw and holds the lower teeth in place. It articulates with the skull at the temporomandibular joints (TMJ) and is the only movable bone of the skull.',
    diseases: [
      {
        id: 'mandible_fracture',
        name: 'Mandible Fracture',
        description: 'Break in the lower jaw bone, often from trauma, falls, or assault.',
        symptoms: ['Jaw pain', 'Swelling', 'Malocclusion', 'Difficulty opening mouth', 'Numbness of lower lip'],
        prescriptions: ['Soft diet', 'Avoid movement', 'Maxillofacial/ENT referral', 'Imaging (CT)'],
        medicines: [
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '5-7 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '5-7 days' },
        ],
        notes: 'Multiple or displaced fractures often need surgical fixation. Rule out airway compromise.',
      },
    ],
  },
}
