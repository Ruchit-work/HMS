"use client"

import { useState } from "react"
import { UserData } from "@/types/patient"
import { Branch } from "@/types/branch"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/firebase/config"

interface PatientInfoStepProps {
  user: { uid: string; email: string | null }
  userData: UserData
  branches: Branch[]
  selectedBranchId: string
  loadingBranches: boolean
  slideDirection: 'right' | 'left'
  onBranchSelect: (branchId: string, branch: Branch) => void
}

export default function PatientInfoStep({
  user,
  userData,
  branches,
  selectedBranchId,
  loadingBranches,
  slideDirection,
  onBranchSelect
}: PatientInfoStepProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState<Record<string, unknown>>({})
  const [localUserData, setLocalUserData] = useState<UserData>(userData)

  const startEdit = (field: string, initial: unknown) => {
    setEditingField(field)
    setProfileDraft({ [field]: initial ?? "" })
  }

  const cancelEdit = () => {
    setEditingField(null)
    setProfileDraft({})
  }

  const saveField = async (field: string) => {
    if (!user) return
    try {
      await updateDoc(doc(db, "patients", user.uid), { 
        [field]: profileDraft[field], 
        updatedAt: new Date().toISOString() 
      })
      setLocalUserData(prev => ({ ...prev, [field]: profileDraft[field] as never }))
    } catch {
    } finally {
      setEditingField(null)
      setProfileDraft({})
    }
  }

  return (
    <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
      <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">👤</span>
          <span>Patient Information</span>
          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium ml-2">Auto-filled</span>
        </h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">Patient ID</p>
            <p className="text-sm font-mono text-slate-700 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
              {user?.uid || ""}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">First Name</p>
              <p className="text-base font-medium text-slate-800 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                {userData?.firstName || ""}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Last Name</p>
              <p className="text-base font-medium text-slate-800 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                {userData?.lastName || ""}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                Phone {userData?.phoneNumber && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">From Profile</span>
                )}
              </p>
              {editingField === 'phoneNumber' ? (
                <div className="flex gap-2">
                  <input 
                    type="tel" 
                    defaultValue={String(userData?.phoneNumber || "")} 
                    onChange={(e) => setProfileDraft({ phoneNumber: e.target.value })} 
                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                  />
                  <button type="button" onClick={() => saveField('phoneNumber')} className="btn-modern btn-modern-purple btn-modern-sm">
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                  <span className="text-base text-slate-800">{userData?.phoneNumber || "Not provided"}</span>
                  <button type="button" onClick={() => startEdit('phoneNumber', userData?.phoneNumber)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Email</p>
              <p className="text-base text-slate-700 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                {userData?.email || ""}
              </p>
            </div>
          </div>
          
          {/* Quick optional profile edits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Allergies</p>
              {editingField === 'allergies' ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    defaultValue={String(userData?.allergies || "")} 
                    onChange={(e) => setProfileDraft({ allergies: e.target.value })} 
                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                  />
                  <button type="button" onClick={() => saveField('allergies')} className="btn-modern btn-modern-purple btn-modern-sm">
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                  <span className="text-base text-slate-800">{userData?.allergies || "None reported"}</span>
                  <button type="button" onClick={() => startEdit('allergies', userData?.allergies)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Current Medications</p>
              {editingField === 'currentMedications' ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    defaultValue={String(userData?.currentMedications || "")} 
                    onChange={(e) => setProfileDraft({ currentMedications: e.target.value })} 
                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                  />
                  <button type="button" onClick={() => saveField('currentMedications')} className="btn-modern btn-modern-purple btn-modern-sm">
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                  <span className="text-base text-slate-800">{userData?.currentMedications || "None"}</span>
                  <button type="button" onClick={() => startEdit('currentMedications', userData?.currentMedications)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Smoking</p>
              {editingField === 'smokingHabits' ? (
                <div className="flex gap-2">
                  <select 
                    value={String((profileDraft.smokingHabits ?? localUserData?.smokingHabits) || "")} 
                    onChange={(e) => setProfileDraft({ smokingHabits: e.target.value })} 
                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select</option>
                    <option value="Never">Never</option>
                    <option value="Occasionally">Occasionally</option>
                    <option value="Regularly">Regularly</option>
                  </select>
                  <button type="button" onClick={() => saveField('smokingHabits')} className="btn-modern btn-modern-purple btn-modern-sm">
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                  <span className="text-base text-slate-800">{localUserData?.smokingHabits || "Not provided"}</span>
                  <button type="button" onClick={() => startEdit('smokingHabits', userData?.smokingHabits)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Drinking</p>
              {editingField === 'drinkingHabits' ? (
                <div className="flex gap-2">
                  <select 
                    value={String((profileDraft.drinkingHabits ?? localUserData?.drinkingHabits) || "")} 
                    onChange={(e) => setProfileDraft({ drinkingHabits: e.target.value })} 
                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select</option>
                    <option value="Never">Never</option>
                    <option value="Occasionally">Occasionally</option>
                    <option value="Regularly">Regularly</option>
                  </select>
                  <button type="button" onClick={() => saveField('drinkingHabits')} className="btn-modern btn-modern-purple btn-modern-sm">
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                  <span className="text-base text-slate-800">{localUserData?.drinkingHabits || "Not provided"}</span>
                  <button type="button" onClick={() => startEdit('drinkingHabits', userData?.drinkingHabits)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Branch Selection */}
          <div className="mt-6 pt-6 border-t-2 border-slate-300">
            <label className="block text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-xl">🏥</span>
              <span>Select Branch <span className="text-red-500">*</span></span>
            </label>
            {loadingBranches ? (
              <div className="text-center py-4">
                <svg className="animate-spin h-6 w-6 mx-auto text-slate-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-xs text-slate-500 mt-2">Loading branches...</p>
              </div>
            ) : branches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {branches.map((branch) => {
                  const isSelected = selectedBranchId === branch.id
                  const isDefault = userData?.defaultBranchId === branch.id
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => onBranchSelect(branch.id, branch)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-teal-600 bg-teal-50 shadow-md ring-2 ring-teal-200"
                          : "border-slate-300 hover:border-slate-400 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-lg font-bold text-slate-800">{branch.name}</span>
                        {isSelected && (
                          <span className="text-teal-600 text-xl">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{branch.location}</p>
                      {isDefault && (
                        <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Your Default Branch
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600">No branches available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

