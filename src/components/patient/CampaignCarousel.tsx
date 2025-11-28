"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Campaign, getContentPreview, getPlainText, shouldTruncate } from "@/utils/campaigns"
import { sanitizeForInnerHTML } from "@/utils/sanitizeHtml"

interface CampaignCarouselProps {
  campaigns: Campaign[]
}

interface CampaignCardProps {
  campaign: Campaign
  gradient: string
  index: number
}

// CampaignCard component - merged into carousel
function CampaignCard({ campaign, gradient, index }: CampaignCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const isExternal = campaign.ctaHref?.startsWith("http")
  const CTAContent = campaign.ctaText || "Learn more"
  
  // Get content preview (first 150 characters)
  const fullContent = campaign.content || ""
  const plainTextLength = getPlainText(fullContent).length
  const shouldShowTruncate = shouldTruncate(fullContent, 150)
  const displayContent = isExpanded || !shouldShowTruncate 
    ? fullContent 
    : getContentPreview(fullContent, 150)

  const CTAElement = campaign.ctaHref ? (
    isExternal ? (
      <a
        href={campaign.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30 hover:scale-105"
        onClick={(e) => e.stopPropagation()}
      >
        {CTAContent}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    ) : (
      <Link
        href={campaign.ctaHref}
        className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30 hover:scale-105"
        onClick={(e) => e.stopPropagation()}
      >
        {CTAContent}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Link>
    )
  ) : null

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br ${gradient} p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl`}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-16 left-16 h-44 w-44 rounded-full bg-white/80 blur-2xl" />
      </div>

      <div className="relative space-y-4 text-white">
        <span className="inline-flex items-center rounded-full bg-white/25 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
          Featured campaign
        </span>
        <h3 className="text-xl font-bold leading-tight line-clamp-2">
          {campaign.title}
        </h3>
        <div
          className={`text-sm leading-relaxed text-white/95 ${
            !isExpanded 
              ? 'overflow-hidden' 
              : ''
          }`}
          style={!isExpanded ? {
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical' as const,
            textOverflow: 'ellipsis',
            maxHeight: '6rem'
          } : {}}
          dangerouslySetInnerHTML={sanitizeForInnerHTML(displayContent)}
        />
        {shouldShowTruncate && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="text-xs font-semibold text-white/90 underline hover:text-white transition mt-1"
          >
            {isExpanded ? "Read less" : "Read more"}
          </button>
        )}
        {CTAElement && <div className="pt-2">{CTAElement}</div>}
      </div>
    </article>
  )
}

export default function CampaignCarousel({ campaigns }: CampaignCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  const gradients = [
    "from-sky-600 via-sky-500 to-cyan-500",
    "from-emerald-600 via-teal-500 to-emerald-400",
    "from-purple-600 via-fuchsia-500 to-rose-500",
    "from-orange-600 via-amber-500 to-yellow-400",
    "from-indigo-600 via-blue-500 to-cyan-400",
  ]

  // Auto-advance carousel every 5 seconds (only if not paused and multiple campaigns)
  useEffect(() => {
    if (campaigns.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % campaigns.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [campaigns.length, isPaused])

  // Reset pause after 10 seconds of inactivity
  useEffect(() => {
    if (!isPaused) return

    const timeout = setTimeout(() => {
      setIsPaused(false)
    }, 10000)

    return () => clearTimeout(timeout)
  }, [isPaused, currentIndex])

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }

    const distance = touchStart - touchEnd
    const minSwipeDistance = 50

    if (distance > minSwipeDistance) {
      // Swipe left - next campaign
      goToNext()
    } else if (distance < -minSwipeDistance) {
      // Swipe right - previous campaign
      goToPrevious()
    }

    // Reset touch state
    setTouchStart(null)
    setTouchEnd(null)
  }

  const goToNext = () => {
    setIsPaused(true)
    setCurrentIndex((prev) => (prev + 1) % campaigns.length)
  }

  const goToPrevious = () => {
    setIsPaused(true)
    setCurrentIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length)
  }

  const goToSlide = (index: number) => {
    setIsPaused(true)
    setCurrentIndex(index)
  }

  if (campaigns.length === 0) {
    return null
  }

  if (campaigns.length === 1) {
    // If only one campaign, show it without carousel controls
    return (
      <div className="w-full">
        <CampaignCard
          campaign={campaigns[0]}
          gradient={gradients[0]}
          index={0}
        />
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {/* Carousel Container */}
      <div
        className="relative overflow-hidden rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Campaign Slides */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            willChange: 'transform',
          }}
        >
          {campaigns.map((campaign, index) => {
            const gradient = gradients[index % gradients.length]
            return (
              <div
                key={campaign.id}
                className="min-w-full flex-shrink-0 w-full"
                style={{ flex: '0 0 100%' }}
              >
                <CampaignCard
                  campaign={campaign}
                  gradient={gradient}
                  index={index}
                />
              </div>
            )
          })}
        </div>

        {/* Navigation Arrows - Only show if more than 1 campaign */}
        {campaigns.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 backdrop-blur-sm p-2.5 text-white transition hover:bg-white/30 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
              aria-label="Previous campaign"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 backdrop-blur-sm p-2.5 text-white transition hover:bg-white/30 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
              aria-label="Next campaign"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator - Only show if more than 1 campaign */}
      {campaigns.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {campaigns.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "w-8 bg-white/90"
                  : "w-2 bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Go to campaign ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Campaign Counter - Only show if more than 1 campaign */}
      {campaigns.length > 1 && (
        <div className="mt-2 text-center text-xs text-white/70">
          Campaign {currentIndex + 1} of {campaigns.length}
        </div>
      )}
    </div>
  )
}

