import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { Appointment } from "@/types/patient"

export async function GET(request: Request) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist whatsapp-bookings API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured" }, { status: 500 })
    }

    const firestore = admin.firestore()
    
    // Get receptionist's branchId if user is a receptionist
    let receptionistBranchId: string | null = null
    if (auth.user && auth.user.role === "receptionist") {
      try {
        const receptionistDoc = await firestore.collection("receptionists").doc(auth.user.uid).get()
        if (receptionistDoc.exists) {
          const receptionistData = receptionistDoc.data()
          receptionistBranchId = receptionistData?.branchId || null
        }
      } catch (err) {
        console.warn("[WhatsApp Bookings API] Failed to fetch receptionist branch:", err)
      }
    }
    
    // Get user's active hospital ID
    const { getUserActiveHospitalId } = await import("@/utils/serverHospitalQueries")
    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    
    // Fetch appointments with whatsappPending flag or status whatsapp_pending
    // Note: Can't use orderBy with where in Firestore without composite index, so we fetch and sort in memory
    const appointmentMap = new Map<string, any>()
    
    // Fetch from hospital-scoped collections if hospitalId is available
    if (hospitalId) {
      try {
        const hospAppointmentsRef = firestore.collection(`hospitals/${hospitalId}/appointments`)
        let whatsappQuery
        if (receptionistBranchId) {
          whatsappQuery = hospAppointmentsRef
            .where("whatsappPending", "==", true)
            .where("branchId", "==", receptionistBranchId)
            .limit(100)
        } else {
          whatsappQuery = hospAppointmentsRef
            .where("whatsappPending", "==", true)
            .limit(100)
        }
        
        const appointmentsSnapshot = await whatsappQuery.get()
        appointmentsSnapshot.docs.forEach((doc) => {
          appointmentMap.set(doc.id, { id: doc.id, ...doc.data() })
        })
      } catch (error: any) {
        console.error("[WhatsApp Bookings API] Error fetching hospital-scoped whatsappPending appointments:", error)
      }
      
      // Also fetch appointments with status whatsapp_pending (for backward compatibility)
      try {
        const hospAppointmentsRef = firestore.collection(`hospitals/${hospitalId}/appointments`)
        let pendingQuery
        if (receptionistBranchId) {
          pendingQuery = hospAppointmentsRef
            .where("status", "==", "whatsapp_pending")
            .where("branchId", "==", receptionistBranchId)
            .limit(100)
        } else {
          pendingQuery = hospAppointmentsRef
            .where("status", "==", "whatsapp_pending")
            .limit(100)
        }
        
        const pendingSnapshot = await pendingQuery.get()
        pendingSnapshot.docs.forEach((doc) => {
          if (!appointmentMap.has(doc.id)) {
            appointmentMap.set(doc.id, { id: doc.id, ...doc.data() })
          }
        })
      } catch (error: any) {
        console.error("[WhatsApp Bookings API] Error fetching hospital-scoped whatsapp_pending appointments:", error)
      }
    }
    
    // Fallback to root collection if no hospital-scoped data found (for backward compatibility)
    if (appointmentMap.size === 0) {
      try {
        let rootQuery
        if (receptionistBranchId) {
          rootQuery = firestore
            .collection("appointments")
            .where("whatsappPending", "==", true)
            .where("branchId", "==", receptionistBranchId)
            .limit(100)
        } else {
          rootQuery = firestore
            .collection("appointments")
            .where("whatsappPending", "==", true)
            .limit(100)
        }
        
        const appointmentsSnapshot = await rootQuery.get()
        appointmentsSnapshot.docs.forEach((doc) => {
          appointmentMap.set(doc.id, { id: doc.id, ...doc.data() })
        })
      } catch (error: any) {
        console.error("[WhatsApp Bookings API] Error fetching whatsappPending appointments:", error)
      }

      // Also fetch appointments with status whatsapp_pending (for backward compatibility)
      try {
        let pendingQuery
        if (receptionistBranchId) {
          pendingQuery = firestore
            .collection("appointments")
            .where("status", "==", "whatsapp_pending")
            .where("branchId", "==", receptionistBranchId)
            .limit(100)
        } else {
          pendingQuery = firestore
            .collection("appointments")
            .where("status", "==", "whatsapp_pending")
            .limit(100)
        }
        
        const pendingSnapshot = await pendingQuery.get()
        pendingSnapshot.docs.forEach((doc) => {
          if (!appointmentMap.has(doc.id)) {
            appointmentMap.set(doc.id, { id: doc.id, ...doc.data() })
          }
        })
      } catch (error: any) {
        console.error("[WhatsApp Bookings API] Error fetching whatsapp_pending appointments:", error)
      }
    }

    const appointments: Appointment[] = Array.from(appointmentMap.values()).map((data: any) => {
      // Map whatsapp_pending status to pending for type compatibility
      let status: "pending" | "confirmed" | "completed" | "cancelled" = "pending"
      if (data.status === "whatsapp_pending" || data.whatsappPending) {
        status = "pending"
      } else if (data.status === "confirmed") {
        status = "confirmed"
      } else if (data.status === "completed") {
        status = "completed"
      } else if (data.status === "cancelled") {
        status = "cancelled"
      }
      
      return {
        id: data.id,
        patientId: data.patientId || "",
        patientUid: data.patientUid || data.patientId || "",
        patientName: data.patientName || "Unknown",
        patientEmail: data.patientEmail || "",
        patientPhone: data.patientPhone || "",
        doctorId: data.doctorId || "",
        doctorName: data.doctorName || "",
        doctorSpecialization: data.doctorSpecialization || "",
        appointmentDate: data.appointmentDate || "",
        appointmentTime: data.appointmentTime || "",
        chiefComplaint: data.chiefComplaint || "General consultation",
        medicalHistory: data.medicalHistory || "",
        paymentStatus: data.paymentStatus || "pending",
        paymentMethod: data.paymentMethod || "cash",
        paymentType: (data.paymentType as "full" | "partial") || "full",
        totalConsultationFee: data.totalConsultationFee || data.consultationFee || 0, // Doctor fee
        paymentAmount: data.paymentAmount || 0,
        remainingAmount: data.remainingAmount || data.totalConsultationFee || data.consultationFee || 0, // Based on doctor fee
        transactionId: data.transactionId || data.id,
        paidAt: data.paidAt || "",
        status,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      } as Appointment
    })

    // Sort by creation date (newest first)
    appointments.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    return Response.json({ appointments })
  } catch (error: any) {
    console.error("[WhatsApp Bookings API] Error fetching bookings:", error)
    return Response.json(
      { error: "Failed to fetch WhatsApp bookings", details: error.message },
      { status: 500 }
    )
  }
}

