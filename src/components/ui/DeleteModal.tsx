'use client'

interface DeleteModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    subtitle: string
    itemType: string
    itemDetails: {
        name: string
        email?: string
        phone?: string
        specialization?: string
        qualification?: string
        id: string
        [key: string]: any
    }
    loading?: boolean
}

export default function DeleteModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    subtitle, 
    itemType, 
    itemDetails, 
    loading = false 
}: DeleteModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                {/* Modal Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
                            <p className="text-xs sm:text-sm text-gray-500">{subtitle}</p>
                        </div>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="px-4 sm:px-6 py-4">
                    <p className="text-sm text-gray-600 mb-4">
                        Are you sure you want to delete this {itemType}? This will permanently remove all {itemType} data.
                    </p>
                    
                    {/* Item Info */}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{itemType} Details:</h4>
                        <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-gray-600">
                                <span className="font-medium">Name:</span> {itemDetails.name}
                            </p>
                            {itemDetails.email && (
                                <p className="text-xs sm:text-sm text-gray-600">
                                    <span className="font-medium">Email:</span> {itemDetails.email}
                                </p>
                            )}
                            {itemDetails.phone && (
                                <p className="text-xs sm:text-sm text-gray-600">
                                    <span className="font-medium">Phone:</span> {itemDetails.phone}
                                </p>
                            )}
                            {itemDetails.specialization && (
                                <p className="text-xs sm:text-sm text-gray-600">
                                    <span className="font-medium">Specialization:</span> {itemDetails.specialization}
                                </p>
                            )}
                            {itemDetails.qualification && (
                                <p className="text-xs sm:text-sm text-gray-600">
                                    <span className="font-medium">Qualification:</span> {itemDetails.qualification}
                                </p>
                            )}
                            <p className="text-xs sm:text-sm text-gray-600">
                                <span className="font-medium">ID:</span> <span className="font-mono text-xs">{itemDetails.id}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-3 sm:px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                        {loading ? `Deleting ${itemType}...` : `Delete ${itemType}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
