"use client"

import { useState, useEffect } from "react"

interface Slide {
  id: number
  image: string
  title: string
  description: string
  cta?: string
  ctaLink?: string
}

const slides: Slide[] = [
  {
    id: 1,
    image: "/images/Doctor.jpg",
    title: "Welcome to Modern Healthcare",
    description: "Experience world-class medical care with our team of expert doctors and state-of-the-art facilities",
    cta: "Book Appointment",
    ctaLink: "/patient-dashboard/book-appointment"
  },
  {
    id: 2,
    image: "/images/room.jpg",
    title: "24/7 Emergency Services",
    description: "Round-the-clock emergency care with our dedicated trauma team and advanced life support systems",
    cta: "Emergency Contact",
    ctaLink: "/patient-dashboard/emergency"
  },
  {
    id: 3,
    image: "/images/nurse.jpg",
    title: "150+ Specialist Doctors",
    description: "Expert care across 30+ medical specializations with cutting-edge diagnostic and treatment facilities",
    cta: "Browse Doctors",
    ctaLink: "/patient-dashboard/doctors"
  },
  {
    id: 4,
    image: "/images/x-ray.jpg",
    title: "Advanced Diagnostic Services",
    description: "Latest technology including MRI, CT Scan, Digital X-Ray, and comprehensive laboratory services",
    cta: "Our Services",
    ctaLink: "/patient-dashboard/services"
  },
  {
    id: 5,
    image: "/images/patient.jpg",
    title: "Patient-Centered Care",
    description: "Your health and comfort are our priority. Experience compassionate care in a modern healing environment",
    cta: "View Facilities",
    ctaLink: "/patient-dashboard/facilities"
  }
]

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  return (
    <div className="relative w-full h-[500px] sm:h-[600px] lg:h-[700px] xl:h-[750px] overflow-hidden shadow-lg group">
      <div className="relative w-full h-full">
        {slides.map((slide, index) => {
          const isActive = index === currentSlide
          const slideClasses = `absolute inset-0 transition-all duration-700 ease-in-out ${
            isActive ? 'opacity-100 translate-x-0 z-10' : index < currentSlide ? 'opacity-0 -translate-x-full z-0' : 'opacity-0 translate-x-full z-0'
          }`

          return (
            <div key={slide.id} className={slideClasses}>
            <div className="relative w-full h-full">
              {/* Background Image */}
              <img 
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
              
              {/* Dark Overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent z-10" />
                
                <div className="absolute inset-0 z-20 flex items-center">
                  <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl">
                      <h1 
                        className={`text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-4 sm:mb-6 transition-all duration-700 delay-100 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                        style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
                      >
                        {slide.title}
                      </h1>

                      <p 
                        className={`text-base sm:text-lg lg:text-xl text-gray-100 mb-6 sm:mb-8 leading-relaxed transition-all duration-700 delay-200 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                        style={{ textShadow: '0 1px 5px rgba(0,0,0,0.3)' }}
                      >
                        {slide.description}
                      </p>

                      {slide.cta && (
                        <a
                          href={slide.ctaLink}
                          className={`inline-block px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-300 hover-lift ${isActive ? 'opacity-100 translate-y-0 delay-300' : 'opacity-0 translate-y-8'}`}
                        >
                          {slide.cta}
                          <span className="ml-2">→</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 sm:p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Previous slide"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 sm:p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Next slide"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2 sm:gap-3">
        {slides.map((_, index) => {
          const dotClasses = `transition-all duration-300 rounded-full ${index === currentSlide ? 'w-8 sm:w-10 h-2 sm:h-2.5 bg-white' : 'w-2 sm:w-2.5 h-2 sm:h-2.5 bg-white/50 hover:bg-white/75'}`
          
          return (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={dotClasses}
              aria-label={`Go to slide ${index + 1}`}
            />
          )
        })}
      </div>

      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
          aria-label={isAutoPlaying ? "Pause autoplay" : "Resume autoplay"}
        >
          {isAutoPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {isAutoPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
          <div 
            className="h-full bg-white transition-all duration-100 ease-linear"
            style={{
              width: '0%',
              animation: 'progress 5s linear forwards'
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}
