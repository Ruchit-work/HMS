"use client"

import Link from "next/link"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          
          {/* About HMS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                <span className="font-bold text-xl">H</span>
              </div>
              <h3 className="text-xl font-bold text-white">HMS</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Your trusted healthcare partner, providing world-class medical services with compassion and excellence for over 25 years.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-teal-600 transition-colors">
                <span className="text-lg">📘</span>
              </a>
              <a href="#" className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-teal-600 transition-colors">
                <span className="text-lg">🐦</span>
              </a>
              <a href="#" className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-teal-600 transition-colors">
                <span className="text-lg">📸</span>
              </a>
              <a href="#" className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-teal-600 transition-colors">
                <span className="text-lg">💼</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/patient-dashboard" className="text-sm hover:text-teal-400 transition-colors flex items-center gap-2">
                  <span>→</span>
                  <span>Patient Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/patient-dashboard/doctors" className="text-sm hover:text-teal-400 transition-colors flex items-center gap-2">
                  <span>→</span>
                  <span>Find Doctors</span>
                </Link>
              </li>
              <li>
                <Link href="/patient-dashboard/services" className="text-sm hover:text-teal-400 transition-colors flex items-center gap-2">
                  <span>→</span>
                  <span>Our Services</span>
                </Link>
              </li>
              <li>
                <Link href="/patient-dashboard/facilities" className="text-sm hover:text-teal-400 transition-colors flex items-center gap-2">
                  <span>→</span>
                  <span>Facilities</span>
                </Link>
              </li>
              <li>
                <Link href="/patient-dashboard/book-appointment" className="text-sm hover:text-teal-400 transition-colors flex items-center gap-2">
                  <span>→</span>
                  <span>Book Appointment</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-teal-400 text-lg mt-0.5">📍</span>
                <div className="text-sm">
                  <p className="text-white font-medium mb-1">Address</p>
                  <p className="text-slate-400">123 Medical Street, Healthcare City, HC 12345</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-teal-400 text-lg mt-0.5">📞</span>
                <div className="text-sm">
                  <p className="text-white font-medium mb-1">Phone</p>
                  <p className="text-slate-400">+91 123 456 7890</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-teal-400 text-lg mt-0.5">✉️</span>
                <div className="text-sm">
                  <p className="text-white font-medium mb-1">Email</p>
                  <p className="text-slate-400">support@hms-hospital.com</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Working Hours */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Working Hours</h3>
            <ul className="space-y-2">
              <li className="flex justify-between text-sm border-b border-slate-800 pb-2">
                <span className="text-slate-400">OPD Hours</span>
                <span className="text-white font-medium">8:00 AM - 8:00 PM</span>
              </li>
              <li className="flex justify-between text-sm border-b border-slate-800 pb-2">
                <span className="text-slate-400">Emergency</span>
                <span className="text-teal-400 font-medium">24/7 Open</span>
              </li>
              <li className="flex justify-between text-sm border-b border-slate-800 pb-2">
                <span className="text-slate-400">Pharmacy</span>
                <span className="text-teal-400 font-medium">24/7 Open</span>
              </li>
              <li className="flex justify-between text-sm border-b border-slate-800 pb-2">
                <span className="text-slate-400">Lab Services</span>
                <span className="text-white font-medium">7:00 AM - 9:00 PM</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-slate-400">Visiting Hours</span>
                <span className="text-white font-medium">4:00 PM - 7:00 PM</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Certifications Bar */}
        <div className="border-t border-slate-800 pt-6 mb-6">
          <div className="flex flex-wrap justify-center items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">🏅</span>
              <span className="text-slate-400">NABH Accredited</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">✅</span>
              <span className="text-slate-400">ISO 9001:2015</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">🔬</span>
              <span className="text-slate-400">NABL Approved</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">⚕️</span>
              <span className="text-slate-400">JCI Certified</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-400">
              © {currentYear} HMS Hospital. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/privacy" className="hover:text-teal-400 transition-colors">Privacy Policy</Link>
              <a href="#" className="hover:text-teal-400 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-teal-400 transition-colors">Refund Policy</a>
              <a href="#" className="hover:text-teal-400 transition-colors">Sitemap</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}



