import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"
import { DocumentFilter, DocumentMetadata } from "@/types/document"

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist", "patient", "admin"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Initialize Firebase Admin
    const initResult = initFirebaseAdmin("documents-list API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
    const { searchParams } = new URL(request.url)

    // Get filters from query params
    const patientId = searchParams.get("patientId")
    const patientUid = searchParams.get("patientUid")
    const appointmentId = searchParams.get("appointmentId")
    const fileType = searchParams.get("fileType")
    const specialty = searchParams.get("specialty")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const searchQuery = searchParams.get("search")
    const status = searchParams.get("status") || "active"
    const showAllSpecialties = searchParams.get("showAllSpecialties") === "true"
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : 50 // Default to 50 documents per page
    const lastDocId = searchParams.get("lastDocId") // For cursor-based pagination

    // Get hospital ID
    let hospitalId: string | null = null
    if (user.role === "patient") {
      const patientDoc = await db.collection("patients").doc(user.uid).get()
      if (patientDoc.exists) {
        hospitalId = patientDoc.data()?.hospitalId || null
      }
    } else {
      hospitalId = await getUserActiveHospitalId(user.uid)
    }

    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    // Build query
    // IMPORTANT: When viewing an appointment, show ALL patient documents, not just appointment-linked ones
    // This allows doctors to see all patient history even if documents weren't linked to the appointment
    let query = db.collection(getHospitalCollectionPath(hospitalId, "documents")) as any

    // Apply filters - prioritize patientUid as it's more reliable
    // If both are provided, use patientUid (it's the unique identifier)
    if (patientUid) {
      query = query.where("patientUid", "==", patientUid)
    } else if (patientId) {
      // Only use patientId if patientUid is not provided
      query = query.where("patientId", "==", patientId)
    }

    // NOTE: We intentionally DON'T filter by appointmentId here
    // This allows doctors to see all patient documents when viewing an appointment
    // Documents linked to the appointment will be marked with isLinkedToAppointment flag
    if (appointmentId) {
    }

    if (fileType) {
      query = query.where("fileType", "==", fileType)
    }

    if (specialty && !showAllSpecialties) {
      query = query.where("specialty", "==", specialty)
    }

    if (status) {
      query = query.where("status", "==", status)
    }

    // Execute query - try with orderBy, fallback without if index missing
    let snapshot
    let lastDocument: any = null
    try {
      let finalQuery = query.orderBy("uploadedAt", "desc")
      
      // Apply cursor-based pagination if lastDocId is provided
      if (lastDocId) {
        try {
          const lastDocRef = db.collection(getHospitalCollectionPath(hospitalId, "documents")).doc(lastDocId)
          const lastDoc = await lastDocRef.get()
          if (lastDoc.exists) {
            finalQuery = finalQuery.startAfter(lastDoc) as any
          }
        } catch (cursorError: any) {
          // Continue without cursor if it fails
        }
      }
      
      // Always apply limit (default 50, or custom if specified)
      if (limit > 0) {
        finalQuery = finalQuery.limit(limit) as any
      }
      
      snapshot = await finalQuery.get()
      
      // Get the last document for pagination
      if (snapshot.docs.length > 0) {
        lastDocument = snapshot.docs[snapshot.docs.length - 1]
      }
    } catch (error: any) {
      // If orderBy fails (likely missing index), fetch without ordering
      try {
        // Remove orderBy and try again
        let fallbackQuery = db.collection(getHospitalCollectionPath(hospitalId, "documents")) as any
        
        // Use same logic as main query - prioritize patientUid, don't filter by appointmentId
        if (patientUid) {
          fallbackQuery = fallbackQuery.where("patientUid", "==", patientUid)
        } else if (patientId) {
          fallbackQuery = fallbackQuery.where("patientId", "==", patientId)
        }
        // Don't filter by appointmentId - show all patient documents
        if (fileType) {
          fallbackQuery = fallbackQuery.where("fileType", "==", fileType)
        }
        if (specialty && !showAllSpecialties) {
          fallbackQuery = fallbackQuery.where("specialty", "==", specialty)
        }
        if (status) {
          fallbackQuery = fallbackQuery.where("status", "==", status)
        }
        
        // Apply limit (default 50)
        if (limit > 0) {
          fallbackQuery = fallbackQuery.limit(limit) as any
        }
        
        snapshot = await fallbackQuery.get()
        
        // Get the last document for pagination (fallback query)
        if (snapshot.docs.length > 0) {
          lastDocument = snapshot.docs[snapshot.docs.length - 1]
        }
      } catch (fallbackError: any) {
        return NextResponse.json(
          { error: "Failed to fetch documents. Please check Firestore indexes." },
          { status: 500 }
        )
      }
    }

    // Process results
    let documents: DocumentMetadata[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data()
      documents.push({
        id: doc.id,
        ...data,
      } as DocumentMetadata)
    })
    // Additional client-side filtering if both patientId and patientUid were provided
    // This ensures we match documents that have either the patientId OR patientUid
    if (patientId && patientUid) {
      documents = documents.filter(doc => 
        doc.patientId === patientId || doc.patientUid === patientUid
      )
    }
    
    // If appointmentId is provided, prioritize documents linked to that appointment
    // but still show all patient documents
    if (appointmentId && documents.length > 0) {
      // Sort so appointment-linked documents appear first
      documents.sort((a, b) => {
        const aLinked = a.appointmentId === appointmentId ? 1 : 0
        const bLinked = b.appointmentId === appointmentId ? 1 : 0
        if (aLinked !== bLinked) {
          return bLinked - aLinked // Linked documents first
        }
        // Then sort by date
        const dateA = new Date(a.uploadedAt || 0).getTime()
        const dateB = new Date(b.uploadedAt || 0).getTime()
        return dateB - dateA // Descending order (newest first)
      })
    } else {
      // Sort by uploadedAt if not already sorted (fallback case)
      if (documents.length > 0 && documents[0].uploadedAt) {
        documents.sort((a, b) => {
          const dateA = new Date(a.uploadedAt || 0).getTime()
          const dateB = new Date(b.uploadedAt || 0).getTime()
          return dateB - dateA // Descending order (newest first)
        })
      }
    }

    // Sort by uploadedAt if not already sorted (fallback case)
    if (documents.length > 0 && documents[0].uploadedAt) {
      documents.sort((a, b) => {
        const dateA = new Date(a.uploadedAt || 0).getTime()
        const dateB = new Date(b.uploadedAt || 0).getTime()
        return dateB - dateA // Descending order (newest first)
      })
    }

    // Apply additional filters (date range, search) client-side
    if (dateFrom) {
      documents = documents.filter(doc => doc.uploadedAt >= dateFrom)
    }

    if (dateTo) {
      documents = documents.filter(doc => doc.uploadedAt <= dateTo)
    }

    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase()
      documents = documents.filter(doc =>
        doc.fileName.toLowerCase().includes(queryLower) ||
        doc.originalFileName.toLowerCase().includes(queryLower) ||
        doc.description?.toLowerCase().includes(queryLower) ||
        doc.specialty?.toLowerCase().includes(queryLower)
      )
    }

    // For patients, only show their own documents
    if (user.role === "patient" && user.uid !== patientUid) {
      documents = documents.filter(doc => doc.patientUid === user.uid)
    }

    return NextResponse.json({
      success: true,
      documents,
      count: documents.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch documents" },
      { status: 500 }
    )
  }
}

