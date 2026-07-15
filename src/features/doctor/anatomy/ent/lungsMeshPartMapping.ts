/**
 * LUNGS MODEL – EDITABLE MESH-TO-PART MAPPING (16 parts)
 *
 * Use this file to map your GLB mesh/parent names to the 16 anatomy parts.
 * Selection works by: click → get part name for that mesh → highlight all meshes with same part.
 *
 * HOW TO EDIT:
 * 1. Find the actual names in your GLB:
 *    - Open the .glb in Blender (Outliner) or an online GLB viewer and note object/parent names, OR
 *    - In the app, open browser DevTools (F12) → Console, then click a part;
 *      the viewer can log the clicked mesh name (see LUNGS_SELECTION_README.md).
 * 2. For each part below, add every mesh name (or parent group name) that belongs to that part.
 *    Matching is case-insensitive. Add exact names; you can add multiple names per part.
 * 3. Save the file. Only meshes that match a name in this list will get that part;
 *    meshes that don’t match any part won’t highlight (or will use fallback index if enabled).
 *
 * THE 16 PARTS (order matches the dropdown/index fallback):
 *   1. Left_Lung  2. Right_Lung  3. Left_Ventricle  4. Right_Ventricle
 *   5. Right_Atrium  6. Left_Atrium  7. Aorta  8. Left_Pulmonary_Artery  9. Right_Pulmonary_Artery
 *   10. Superior_Caval_Vein  11. Inferior_Caval_Vein  12. Pulmonary_Trunk
 *   13. Right_Pulmonary_Vein  14. Left_Pulmonary_Vein  15. Trachea  16. Bronchi
 */

export const LUNGS_PART_KEYS = [
  'Left_Lung',
  'Right_Lung',
  'Left_Ventricle',
  'Right_Ventricle',
  'Right_Atrium',
  'Left_Atrium',
  'Aorta',
  'Left_Pulmonary_Artery',
  'Right_Pulmonary_Artery',
  'Superior_Caval_Vein',
  'Inferior_Caval_Vein',
  'Pulmonary_Trunk',
  'Right_Pulmonary_Vein',
  'Left_Pulmonary_Vein',
  'Trachea',
  'Bronchi',
] as const

export type LungsPartKey = (typeof LUNGS_PART_KEYS)[number]

/**
 * For each part, list the exact mesh or parent names from your GLB.
 * Add all names that belong to that part (e.g. left lung might have "Left_Lung", "linkerlong", "left lung").
 * Matching is case-insensitive.
 */
export const LUNGS_MESH_NAMES_BY_PART: Record<LungsPartKey, string[]> = {
  Left_Lung: ['Left lung'],
  Right_Lung: ['Right lung'],
  Left_Ventricle: ['Left ventricle'],
  Right_Ventricle: ['Right ventricle'],
  Right_Atrium: ['Right atrium'],
  Left_Atrium: ['Left atrium'],
  Aorta: ['Aorta'],
  Left_Pulmonary_Artery: ['Left pulmonary artery'],
  Right_Pulmonary_Artery: ['Right pulmonary artery'],
  Superior_Caval_Vein: ['Superior caval vein'],
  Inferior_Caval_Vein: ['Inferior caval vein'],
  Pulmonary_Trunk: ['Pulmonary trunk'],
  Right_Pulmonary_Vein: ['Right pulmonary vein'],
  Left_Pulmonary_Vein: ['Left pulmonary vein'],
  Trachea: ['Trachea'],
  Bronchi: ['Bronchi'],
}
