"use client"

interface RoomAvailabilityRow {
  name: string
  occupied: number
  total: number
  colorClass: string
}

interface RoomAvailabilityProps {
  rows: RoomAvailabilityRow[]
  onManageRooms: () => void
}

export default function RoomAvailability({ rows, onManageRooms }: RoomAvailabilityProps) {
  return (
    <div className="space-y-4">
      {rows.map((room) => {
        const percent = room.total > 0 ? Math.round((room.occupied / room.total) * 100) : 0
        return (
          <div key={room.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <p className="font-medium text-slate-800">{room.name}</p>
              <p className="text-xs text-slate-500">
                {room.occupied} / {room.total}
              </p>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${room.colorClass}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
      <button
        onClick={onManageRooms}
        className="w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
      >
        Manage Rooms
      </button>
    </div>
  )
}

export type { RoomAvailabilityRow }
