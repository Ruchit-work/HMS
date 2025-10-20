'use client'

import { ReactNode } from 'react'

interface ViewModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle: string
    headerColor: 'blue' | 'green' | 'purple' | 'orange'
    children: ReactNode
}

export default function ViewModal({ 
    isOpen, 
    onClose, 
    title, 
    subtitle, 
    headerColor, 
    children 
}: ViewModalProps) {
    if (!isOpen) return null

    const headerClasses = {
        blue: 'bg-gradient-to-r from-blue-600 to-blue-700',
        green: 'bg-gradient-to-r from-green-600 to-green-700',
        purple: 'bg-gradient-to-r from-purple-600 to-purple-700',
        orange: 'bg-gradient-to-r from-orange-600 to-orange-700'
    }

    const textColorClasses = {
        blue: 'text-blue-100',
        green: 'text-green-100',
        purple: 'text-purple-100',
        orange: 'text-orange-100'
    }

    const hoverClasses = {
        blue: 'hover:text-blue-200 hover:bg-white hover:bg-opacity-20',
        green: 'hover:text-green-200 hover:bg-white hover:bg-opacity-20',
        purple: 'hover:text-purple-200 hover:bg-white hover:bg-opacity-20',
        orange: 'hover:text-orange-200 hover:bg-white hover:bg-opacity-20'
    }

    return (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden transform transition-all duration-300 ease-out">
                {/* Modal Header */}
                <div className={`px-4 sm:px-6 py-4 sm:py-5 ${headerClasses[headerColor]} text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold">{title}</h3>
                                <p className={`text-xs sm:text-sm ${textColorClasses[headerColor]}`}>{subtitle}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className={`text-white transition-colors duration-200 p-2 rounded-lg ${hoverClasses[headerColor]}`}
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
                    {children}
                </div>

                {/* Modal Footer */}
                <div className="px-4 sm:px-8 py-4 bg-white border-t border-gray-200 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md text-sm sm:text-base"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
