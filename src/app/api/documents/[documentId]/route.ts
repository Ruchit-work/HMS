import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"
import { DocumentMetadata } from "@/types/document"
import { getStorage } from "firebase-admin/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }

    const user = auth.user!
    const { documentId } = await params

    const initResult = initFirebaseAdmin("document-get API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
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

    const docRef = db.collection(getHospitalCollectionPath(hospitalId, "documents")).doc(documentId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const documentData = docSnap.data() as Omit<DocumentMetadata, "id">

    // Check access permissions
    if (user.role === "patient" && documentData.patientUid !== user.uid) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Generate fresh download URL
    try {
      const adminApp = admin.app()
      let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      if (storageBucket?.startsWith("gs://")) {
        storageBucket = storageBucket.replace("gs://", "")
      }
      if (!storageBucket && adminApp.options.storageBucket) {
        storageBucket = adminApp.options.storageBucket
      }
      const bucket = storageBucket ? getStorage().bucket(storageBucket) : getStorage().bucket()
      const fileRef = bucket.file(documentData.storagePath)
      const [url] = await fileRef.getSignedUrl({
        action: "read",
        expires: Date.now() + 3600 * 1000, // 1 hour
      })
      documentData.downloadUrl = url
    } catch (err) {
    }

    const document: DocumentMetadata = {
      id: docSnap.id,
      ...documentData,
    }

    return NextResponse.json({
      success: true,
      document,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch document" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Access denied. Only doctors and receptionists can update documents." },
        { status: 403 }
      )
    }

    const { documentId } = await params
    const body = await request.json()

    const initResult = initFirebaseAdmin("document-update API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
    const hospitalId = await getUserActiveHospitalId(user.uid)

    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const docRef = db.collection(getHospitalCollectionPath(hospitalId, "documents")).doc(documentId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Get updater name
    let updaterName = user.email || "Unknown"
    if (user.role === "doctor") {
      const doctorDoc = await db.collection("doctors").doc(user.uid).get()
      if (doctorDoc.exists) {
        const doctorData = doctorDoc.data()
        updaterName = `${doctorData?.firstName || ""} ${doctorData?.lastName || ""}`.trim() || updaterName
      }
    } else if (user.role === "receptionist") {
      const recepDoc = await db.collection("receptionists").doc(user.uid).get()
      if (recepDoc.exists) {
        const recepData = recepDoc.data()
        updaterName = `${recepData?.firstName || ""} ${recepData?.lastName || ""}`.trim() || updaterName
      }
    }

    // Update document
    const updateData: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: {
        uid: user.uid,
        role: user.role as "doctor" | "receptionist",
        name: updaterName,
      },
    }

    if (body.description !== undefined) updateData.description = body.description
    if (body.specialty !== undefined) updateData.specialty = body.specialty
    if (body.fileType !== undefined) updateData.fileType = body.fileType
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.status !== undefined) updateData.status = body.status
    if (body.appointmentId !== undefined) {
      if (body.appointmentId === null) {
        // Unlink from appointment
        const currentDoc = docSnap.data()
        if (currentDoc?.appointmentId) {
          // Remove from appointment's documentIds array
          try {
            const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(currentDoc.appointmentId)
            await appointmentRef.update({
              documentIds: admin.firestore.FieldValue.arrayRemove(documentId),
              updatedAt: new Date().toISOString(),
            })
          } catch (err) {
          }
        }
        updateData.appointmentId = admin.firestore.FieldValue.delete()
        updateData.doctorId = admin.firestore.FieldValue.delete()
        updateData.appointmentDate = admin.firestore.FieldValue.delete()
        updateData.isLinkedToAppointment = false
      } else {
        // Link to new appointment
        updateData.appointmentId = body.appointmentId
        updateData.isLinkedToAppointment = true
        
        // Fetch appointment data to get doctorId and appointmentDate
        if (body.doctorId !== undefined) {
          updateData.doctorId = body.doctorId
        }
        if (body.appointmentDate !== undefined) {
          updateData.appointmentDate = body.appointmentDate
        }
        
        // If doctorId or appointmentDate not provided, fetch from appointment
        if (!body.doctorId || !body.appointmentDate) {
          try {
            const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(body.appointmentId)
            const appointmentDoc = await appointmentRef.get()
            if (appointmentDoc.exists) {
              const appointmentData = appointmentDoc.data()
              if (!body.doctorId && appointmentData?.doctorId) {
                updateData.doctorId = appointmentData.doctorId
              }
              if (!body.appointmentDate && appointmentData?.appointmentDate) {
                updateData.appointmentDate = appointmentData.appointmentDate
              }
            }
          } catch (err) {
            console.warn("[document-update] Failed to fetch appointment data:", err)
          }
        }
        
        // Add to appointment's documentIds array
        try {
          const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(body.appointmentId)
          await appointmentRef.update({
            documentIds: admin.firestore.FieldValue.arrayUnion(documentId),
            updatedAt: new Date().toISOString(),
          })
        } catch (err) {
        }
      }
    }
    
    // Allow updating doctorId and appointmentDate independently
    if (body.doctorId !== undefined && body.appointmentId) {
      updateData.doctorId = body.doctorId
    }
    if (body.appointmentDate !== undefined && body.appointmentId) {
      updateData.appointmentDate = body.appointmentDate
    }

    await docRef.update(updateData)

    const updatedDoc = await docRef.get()
    const documentData = updatedDoc.data() as Omit<DocumentMetadata, "id">

    const document: DocumentMetadata = {
      id: updatedDoc.id,
      ...documentData,
    }

    return NextResponse.json({
      success: true,
      document,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update document" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Access denied. Only doctors and receptionists can delete documents." },
        { status: 403 }
      )
    }

    const { documentId } = await params

    const initResult = initFirebaseAdmin("document-delete API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
    const adminApp = admin.app()
    let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (storageBucket?.startsWith("gs://")) {
      storageBucket = storageBucket.replace("gs://", "")
    }
    if (!storageBucket && adminApp.options.storageBucket) {
      storageBucket = adminApp.options.storageBucket
    }
    const bucket = storageBucket ? getStorage().bucket(storageBucket) : getStorage().bucket()
    const hospitalId = await getUserActiveHospitalId(user.uid)

    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const docRef = db.collection(getHospitalCollectionPath(hospitalId, "documents")).doc(documentId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const documentData = docSnap.data()!

    // Delete from Storage (keep version history by archiving instead of deleting)
    // For now, we'll mark as deleted in Firestore but keep the file
    // You can implement actual file deletion if needed
    try {
      // Unlink from appointment if linked
      if (documentData.appointmentId) {
        try {
          const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(documentData.appointmentId)
          await appointmentRef.update({
            documentIds: admin.firestore.FieldValue.arrayRemove(documentId),
            updatedAt: new Date().toISOString(),
          })
        } catch (err) {
        }
      }

      // Delete the file from Storage
      try {
        const fileRef = bucket.file(documentData.storagePath)
        await fileRef.delete()
      } catch (storageError: any) {
        // If file doesn't exist in storage, that's okay - continue with Firestore deletion
      }

      // Delete the document from Firestore (permanent deletion)
      await docRef.delete()
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete document" },
      { status: 500 }
    )
  }
}

