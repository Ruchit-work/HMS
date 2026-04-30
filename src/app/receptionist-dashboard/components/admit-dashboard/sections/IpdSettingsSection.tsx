"use client"

import type { Room } from "@/types/patient"
import type { Dispatch, SetStateAction } from "react"

type PackageOption = {
  id: string
  packageName: string
  fixedRate: number
  includedItems?: string[]
}

type RoomTypeOption = {
  key: string
  label: string
}

interface IpdSettingsSectionProps {
  handleSeedRecommendedPackages: () => void
  handleOpenCreatePackage: () => void
  managePackageName: string
  setManagePackageName: (value: string) => void
  managePackageRate: string
  setManagePackageRate: (value: string) => void
  managePackageRoomStayEnabled: boolean
  setManagePackageRoomStayEnabled: (value: boolean) => void
  managePackageRoomStayDays: number
  setManagePackageRoomStayDays: (value: number) => void
  managePackageRoomType: string
  setManagePackageRoomType: (value: string) => void
  availableRoomTypes: RoomTypeOption[]
  packageIncludedItemOptions: string[]
  managePackageIncludedItems: string[]
  setManagePackageIncludedItems: Dispatch<SetStateAction<string[]>>
  managePackageExclusions: string
  setManagePackageExclusions: (value: string) => void
  resetPackageForm: () => void
  handleSubmitPackage: () => void
  packageManageLoading: boolean
  packageEditId: string | null
  packagesLoading: boolean
  admissionPackages: PackageOption[]
  handleOpenEditPackage: (pkg: any) => void
  handleArchivePackage: (pkg: any) => void
  handleOpenCreateRoom: () => void
  rooms: Room[]
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  handleOpenEditRoom: (room: Room) => void
  handleArchiveRoom: (room: Room) => void
}

export default function IpdSettingsSection({
  handleSeedRecommendedPackages,
  handleOpenCreatePackage,
  managePackageName,
  setManagePackageName,
  managePackageRate,
  setManagePackageRate,
  managePackageRoomStayEnabled,
  setManagePackageRoomStayEnabled,
  managePackageRoomStayDays,
  setManagePackageRoomStayDays,
  managePackageRoomType,
  setManagePackageRoomType,
  availableRoomTypes,
  packageIncludedItemOptions,
  managePackageIncludedItems,
  setManagePackageIncludedItems,
  managePackageExclusions,
  setManagePackageExclusions,
  resetPackageForm,
  handleSubmitPackage,
  packageManageLoading,
  packageEditId,
  packagesLoading,
  admissionPackages,
  handleOpenEditPackage,
  handleArchivePackage,
  handleOpenCreateRoom,
  rooms,
  getRoomTypeDisplayName,
  handleOpenEditRoom,
  handleArchiveRoom,
}: IpdSettingsSectionProps) {
  return (
    <>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Custom Operation Packages</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSeedRecommendedPackages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add Recommended Templates
            </button>
            <button
              onClick={handleOpenCreatePackage}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
            >
              New Package
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={managePackageName}
            onChange={(e) => setManagePackageName(e.target.value)}
            placeholder="Package name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            value={managePackageRate}
            onChange={(e) => setManagePackageRate(e.target.value)}
            placeholder="Fixed rate"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="rounded-lg border border-slate-300 px-3 py-3 text-sm md:col-span-2">
            <p className="mb-2 font-medium text-slate-700">Included items (select)</p>
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={managePackageRoomStayEnabled}
                  onChange={(e) => setManagePackageRoomStayEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="font-medium">Room stay</span>
              </label>
              <div className="mt-2">
                <select
                  value={managePackageRoomStayDays}
                  onChange={(e) => setManagePackageRoomStayDays(Number(e.target.value))}
                  disabled={!managePackageRoomStayEnabled}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <option key={day} value={day}>
                      {day} day{day > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Preferred room type (auto-fill on admit)</label>
              <select
                value={managePackageRoomType}
                onChange={(e) => setManagePackageRoomType(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="">No preference</option>
                {availableRoomTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {packageIncludedItemOptions.map((item) => {
                const checked = managePackageIncludedItems.includes(item)
                return (
                  <label key={item} className="inline-flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setManagePackageIncludedItems((prev) => {
                          if (e.target.checked) return prev.includes(item) ? prev : [...prev, item]
                          return prev.filter((entry) => entry !== item)
                        })
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{item}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <textarea
            value={managePackageExclusions}
            onChange={(e) => setManagePackageExclusions(e.target.value)}
            placeholder="Exclusions (optional) e.g. blood products, implants"
            rows={2}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={resetPackageForm}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
            disabled={packageManageLoading}
          >
            Reset
          </button>
          <button
            onClick={handleSubmitPackage}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={packageManageLoading}
          >
            {packageManageLoading ? "Saving..." : packageEditId ? "Update Package" : "Create Package"}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Package</th>
                <th className="px-3 py-2 text-left">Rate</th>
                <th className="px-3 py-2 text-left">Included</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packagesLoading ? (
                <tr><td className="px-3 py-3 text-slate-500" colSpan={4}>Loading packages...</td></tr>
              ) : admissionPackages.length === 0 ? (
                <tr><td className="px-3 py-3 text-slate-500" colSpan={4}>No packages found.</td></tr>
              ) : admissionPackages.map((pkg) => (
                <tr key={pkg.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-800">{pkg.packageName}</td>
                  <td className="px-3 py-3 text-slate-700">Rs {pkg.fixedRate}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{(pkg.includedItems || []).slice(0, 4).join(", ") || "—"}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEditPackage(pkg)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">Edit</button>
                      <button onClick={() => handleArchivePackage(pkg)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Room Master</h3>
          <button
            onClick={handleOpenCreateRoom}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            Add Room
          </button>
        </div>
        <div className="rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Room</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Rate</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-800">{room.roomNumber}</td>
                  <td className="px-3 py-3 text-slate-700">{getRoomTypeDisplayName(room)}</td>
                  <td className="px-3 py-3 text-slate-700">Rs {room.ratePerDay}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 capitalize">{room.status}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenEditRoom(room)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">Edit</button>
                      <button onClick={() => handleArchiveRoom(room)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
