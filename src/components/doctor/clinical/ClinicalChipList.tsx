"use client"

interface ClinicalChipListProps {
  items: string[]
  emptyText?: string
  className?: string
}

export default function ClinicalChipList({
  items,
  emptyText = "None recorded",
  className = "",
}: ClinicalChipListProps) {
  if (items.length === 0) {
    return <p className={`clinical-chip-list__empty ${className}`.trim()}>{emptyText}</p>
  }

  return (
    <div className={`clinical-chip-list ${className}`.trim()}>
      {items.map((item) => (
        <span key={item} className="clinical-chip-list__chip">
          {item}
        </span>
      ))}
    </div>
  )
}
