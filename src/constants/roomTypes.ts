import type { RoomType } from '@/types/patient'

export interface HospitalRoomType {
  id: RoomType
  name: string
  description: string
  dailyRate: number
  features: string[]
}

export const ROOM_TYPES: HospitalRoomType[] = [
  {
    id: 'general',
    name: 'General Ward',
    description: 'Shared room for multiple patients with basic facilities.',
    dailyRate: 800,
    features: ['Shared washroom', 'Shared nurse service', 'Basic bed'],
  },
  {
    id: 'semi_private',
    name: 'Semi-Private Room',
    description: 'Room shared between 2–3 patients with moderate comfort.',
    dailyRate: 1500,
    features: ['Attached washroom', 'TV', 'Privacy curtain'],
  },
  {
    id: 'private',
    name: 'Private Room',
    description: 'Single room offering privacy and comfort.',
    dailyRate: 3000,
    features: ['AC', 'Attached bath', 'Visitor chair', 'TV'],
  },
  {
    id: 'deluxe',
    name: 'Deluxe Room',
    description: 'Spacious private room with premium facilities.',
    dailyRate: 5000,
    features: ['AC', 'Refrigerator', 'Sofa', 'TV', 'Attached bath'],
  },
  {
    id: 'vip',
    name: 'Suite / VIP Room',
    description: 'Luxury suite for high-profile patients with top-class care.',
    dailyRate: 10000,
    features: ['Personal attendant', 'Separate sitting area', 'AC', 'TV', 'Refrigerator'],
  },
]

