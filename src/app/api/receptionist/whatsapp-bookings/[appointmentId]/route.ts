import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { NextRequest } from "next/server"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { getHospitalCollectionPath } from "@/utils/serverHospitalQueries"

interface Params {
  appointmentId: string
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
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
    const initResult = initFirebaseAdmin("receptionist whatsapp-bookings update API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured" }, { status: 500 })
    }

    const { appointmentId } = await context.params
    
    // Parse request body with error handling
    let body: any
    try {
      body = await request.json()
    } catch {
      return Response.json(
        { error: "Invalid request body", details: "Failed to parse JSON" },
        { status: 400 }
      )
    }
    
    if (!appointmentId) {
      return Response.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      )
    }

    const firestore = admin.firestore()

    // Prefer hospital-scoped appointment based on provided hospitalId
    let appointmentRef: FirebaseFirestore.DocumentReference | null = null
    let appointmentDoc = null as FirebaseFirestore.DocumentSnapshot | null

    if (body.hospitalId) {
      appointmentRef = firestore
        .collection(getHospitalCollectionPath(body.hospitalId, "appointments"))
        .doc(appointmentId)
      appointmentDoc = await appointmentRef.get()
    }

    // Fallback to legacy global collection if not found or no hospitalId
    if (!appointmentDoc || !appointmentDoc.exists) {
      appointmentRef = firestore.collection("appointments").doc(appointmentId)
      appointmentDoc = await appointmentRef.get()
    }

    if (!appointmentDoc.exists) {
      return Response.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    const appointmentData = appointmentDoc.data()!

    // Validate that this is a WhatsApp booking
    if (!appointmentData.whatsappPending && appointmentData.status !== "whatsapp_pending") {
      return Response.json(
        { error: "This appointment is not a WhatsApp pending booking" },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    }

    // Doctor assignment
    if (body.doctorId) {
      const doctorDoc = await firestore.collection("doctors").doc(body.doctorId).get()
      if (!doctorDoc.exists) {
        return Response.json(
          { error: "Doctor not found" },
          { status: 404 }
        )
      }

      const doctorData = doctorDoc.data()!
      updateData.doctorId = body.doctorId
      updateData.doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
      updateData.doctorSpecialization = doctorData.specialization || ""

      // Set doctor fee (only fee we charge - no separate consultation fee)
      if (doctorData.consultationFee) {
        updateData.consultationFee = doctorData.consultationFee
        updateData.totalConsultationFee = doctorData.consultationFee
        
        // Recalculate remaining amount based on doctor fee
        const paymentAmount = body.paymentAmount !== undefined ? body.paymentAmount : (appointmentData.paymentAmount || 0)
        updateData.remainingAmount = Math.max(doctorData.consultationFee - paymentAmount, 0)
      }

      // Create appointment slot if doctor is assigned
      const appointmentDate = body.appointmentDate || appointmentData.appointmentDate
      const appointmentTime = body.appointmentTime || appointmentData.appointmentTime
      
      if (appointmentDate && appointmentTime) {
        const { normalizeTime } = await import("@/utils/timeSlots")
        const normalizedTime = normalizeTime(appointmentTime)
        const newSlotDocId = `${body.doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
        const newSlotRef = firestore.collection("appointmentSlots").doc(newSlotDocId)
        
        // Check if doctor, date, or time is being changed
        const isDoctorChanged = appointmentData.doctorId !== body.doctorId
        const isDateChanged = body.appointmentDate && body.appointmentDate !== appointmentData.appointmentDate
        const oldAppointmentTime = appointmentData.appointmentTime || ""
        const newAppointmentTime = body.appointmentTime || ""
        const isTimeChanged = newAppointmentTime && normalizeTime(newAppointmentTime) !== normalizeTime(oldAppointmentTime)
        
        // Only check slot availability and update slot if doctor, date, or time is being changed
        if (isDoctorChanged || isDateChanged || isTimeChanged) {
          // Check if the new slot is already booked by another appointment
          const newSlotDoc = await newSlotRef.get()
          if (newSlotDoc.exists && newSlotDoc.data()?.appointmentId !== appointmentId) {
            return Response.json(
              { error: "Time slot is already booked for this doctor and date" },
              { status: 400 }
            )
          }

          // Update slot in transaction - ensure no duplicates and proper cleanup
          await firestore.runTransaction(async (transaction) => {
            // STEP 1: DO ALL READS FIRST (Firestore requirement)
            
            // Get old date and time for cleanup
            const oldAppointmentDate = appointmentData.appointmentDate
            const oldAppointmentTime = appointmentData.appointmentTime
            const oldNormalizedTime = oldAppointmentTime ? normalizeTime(oldAppointmentTime) : null
            
            // Read old PENDING slot (if date/time changed or if it was pending)
            let oldPendingSlotRef = null
            let oldPendingSlotSnap = null
            if (oldAppointmentDate && oldNormalizedTime) {
              const oldPendingSlotId = `PENDING_${oldAppointmentDate}_${oldNormalizedTime}`.replace(/[:\s]/g, "-")
              oldPendingSlotRef = firestore.collection("appointmentSlots").doc(oldPendingSlotId)
              oldPendingSlotSnap = await transaction.get(oldPendingSlotRef)
            }
            
            // Read old doctor slot (if doctor, date, or time is being changed)
            let oldDoctorSlotRef = null
            let oldDoctorSlotSnap = null
            if (appointmentData.doctorId && (isDoctorChanged || isDateChanged || isTimeChanged) && oldAppointmentDate && oldNormalizedTime) {
              const oldDoctorSlotId = `${appointmentData.doctorId}_${oldAppointmentDate}_${oldNormalizedTime}`.replace(/[:\s]/g, "-")
              oldDoctorSlotRef = firestore.collection("appointmentSlots").doc(oldDoctorSlotId)
              oldDoctorSlotSnap = await transaction.get(oldDoctorSlotRef)
            }
            
            // Read new slot to check availability
            const newSlotSnap = await transaction.get(newSlotRef)
            
            // STEP 2: VALIDATE READS
            if (newSlotSnap.exists && newSlotSnap.data()?.appointmentId !== appointmentId) {
              throw new Error("SLOT_ALREADY_BOOKED")
            }
            
            // STEP 3: DO ALL WRITES AFTER READS
            
            if (oldPendingSlotRef && oldPendingSlotSnap && oldPendingSlotSnap.exists && oldPendingSlotSnap.data()?.appointmentId === appointmentId) {
              transaction.delete(oldPendingSlotRef)
            }
            
            if (oldDoctorSlotRef && oldDoctorSlotSnap && oldDoctorSlotSnap.exists && oldDoctorSlotSnap.data()?.appointmentId === appointmentId) {
              transaction.delete(oldDoctorSlotRef)
            }
            
            transaction.set(newSlotRef, {
              appointmentId,
              doctorId: body.doctorId,
              appointmentDate,
              appointmentTime: normalizedTime,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          })
        }
      }
    }

    // Update other fields
    if (body.patientName !== undefined) updateData.patientName = body.patientName
    if (body.patientPhone !== undefined) updateData.patientPhone = body.patientPhone
    if (body.patientEmail !== undefined) updateData.patientEmail = body.patientEmail
    if (body.appointmentDate !== undefined) updateData.appointmentDate = body.appointmentDate
    if (body.appointmentTime !== undefined) updateData.appointmentTime = body.appointmentTime
    if (body.chiefComplaint !== undefined) updateData.chiefComplaint = body.chiefComplaint
    if (body.medicalHistory !== undefined) updateData.medicalHistory = body.medicalHistory
    // No manual consultation fee - only use doctor's fee
    if (body.paymentAmount !== undefined) {
      updateData.paymentAmount = body.paymentAmount
      // Use doctor fee from updateData or appointmentData (doctor fee is the only fee)
      const doctorFee = updateData.totalConsultationFee || appointmentData.totalConsultationFee || appointmentData.consultationFee || 0
      updateData.remainingAmount = Math.max(doctorFee - body.paymentAmount, 0)
    }
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus

   
    let shouldSendNotification = false
    if (updateData.doctorId && body.markConfirmed !== false) {
  
      updateData.status = "confirmed"
      updateData.whatsappPending = false
      shouldSendNotification = true // Send WhatsApp notification to patient
    } else if (updateData.doctorId) {
   
      updateData.status = "confirmed"
      updateData.whatsappPending = false
      // Don't send notification if markConfirmed is explicitly false
    }

    // At this point we know appointmentDoc exists, so appointmentRef must be non-null
    if (!appointmentRef) {
      throw new Error("Internal error: appointmentRef not initialized")
    }

    await appointmentRef.update(updateData)

    // Also update the patient record if patient details were changed
    if (body.patientName !== undefined || body.patientPhone !== undefined || body.patientEmail !== undefined) {
      try {
        const patientId = appointmentData.patientUid || appointmentData.patientId
        if (patientId) {
          const patientRef = firestore.collection("patients").doc(patientId)
          const patientDoc = await patientRef.get()
          
          if (patientDoc.exists) {
            const patientUpdateData: any = {}
            
            // Update patient name if changed
            if (body.patientName !== undefined && body.patientName.trim() !== "") {
              // Split name into firstName and lastName
              const nameParts = body.patientName.trim().split(" ")
              patientUpdateData.firstName = nameParts[0] || ""
              patientUpdateData.lastName = nameParts.slice(1).join(" ") || ""
            }
            
            // Update patient phone if changed
            if (body.patientPhone !== undefined && body.patientPhone.trim() !== "") {
              patientUpdateData.phone = body.patientPhone.trim()
              patientUpdateData.phoneNumber = body.patientPhone.trim() // Also update phoneNumber field for compatibility
            }
            
            // Update patient email if changed
            if (body.patientEmail !== undefined && body.patientEmail.trim() !== "") {
              patientUpdateData.email = body.patientEmail.trim()
            }
            
            if (Object.keys(patientUpdateData).length > 0) {
              patientUpdateData.updatedAt = new Date().toISOString()
              await patientRef.update(patientUpdateData)
            }
          }
        }
      } catch {
        // Don't fail the appointment update if patient update fails
      }
    }

    // Fetch updated appointment
    const updatedDoc = await appointmentRef.get()
    const updatedData = updatedDoc.data()!

    // Send WhatsApp notification to patient with doctor details
    if (shouldSendNotification && updateData.doctorId) {
      try {
        const patientPhone = updatedData.patientPhone || appointmentData.patientPhone
        // Use the updated name from the request body first, then fallback to database values
        const patientName = updateData.patientName || updatedData.patientName || appointmentData.patientName || "Patient"
        
        if (patientPhone) {
          const doctorName = updateData.doctorName || updatedData.doctorName
          const doctorSpecialization = updateData.doctorSpecialization || updatedData.doctorSpecialization || ""
          
          const appointmentDate = updatedData.appointmentDate || appointmentData.appointmentDate
          const appointmentTime = updatedData.appointmentTime || appointmentData.appointmentTime
          
          const dateDisplay = new Date(appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
          
          const [hours, minutes] = appointmentTime.split(":").map(Number)
          const timeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          
          // Use doctor fee (only fee we charge)
          const doctorFee = updatedData.totalConsultationFee || updatedData.consultationFee || appointmentData.totalConsultationFee || appointmentData.consultationFee || 0
          const paymentAmount = updatedData.paymentAmount || appointmentData.paymentAmount || 0
          const paymentMethod = updatedData.paymentMethod || appointmentData.paymentMethod || "cash"
          const paymentStatus = updatedData.paymentStatus || appointmentData.paymentStatus || "pending"
          const remainingAmount = updatedData.remainingAmount || Math.max(doctorFee - paymentAmount, 0)
          
          const message = `🎉 *Appointment Confirmed!*

Hi ${patientName},

Your appointment has been confirmed and booked successfully by our receptionist.

📋 *Appointment Details:*
• 👨‍⚕️ Doctor: ${doctorName}${doctorSpecialization ? ` (${doctorSpecialization})` : ""}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
${updatedData.chiefComplaint ? `• 📝 Reason: ${updatedData.chiefComplaint}` : ""}

💳 *Payment Information:*
• Doctor Fee: ₹${doctorFee}
• Method: ${paymentMethod.toUpperCase()}
• Amount Paid: ₹${paymentAmount}${remainingAmount > 0 ? ` (₹${remainingAmount} due)` : " (paid)"}
• Status: ${paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending"}

✅ Your appointment is confirmed and visible in our system.

If you need to reschedule or have any questions, reply here or call us at +91-XXXXXXXXXX.

See you soon! 🏥`

          const result = await sendWhatsAppNotification({
            to: patientPhone,
            message,
          })

          if (!result.success) {
          }
        } else {
        }
      } catch {
        // Don't fail the update if WhatsApp fails
      }
    }

    return Response.json({
      success: true,
      appointment: {
        id: updatedDoc.id,
        ...updatedData,
      },
    })
  } catch (error: any) {
    if (error.message === "SLOT_ALREADY_BOOKED") {
      return Response.json(
        { error: "Time slot is already booked" },
        { status: 400 }
      )
    }
    // Ensure we always return a proper error response
    const errorMessage = error?.message || error?.toString() || "Unknown error occurred"
    return Response.json(
      { 
        error: "Failed to update WhatsApp booking", 
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
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
    const initResult = initFirebaseAdmin("receptionist whatsapp-bookings delete API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured" }, { status: 500 })
    }

    const { appointmentId } = await context.params
    
    if (!appointmentId) {
      return Response.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      )
    }

    const firestore = admin.firestore()
    const body = await request.json().catch(() => ({}))
    const hospitalId = body.hospitalId

    // Prefer hospital-scoped appointment based on provided hospitalId
    let appointmentRef: FirebaseFirestore.DocumentReference | null = null
    let appointmentDoc = null as FirebaseFirestore.DocumentSnapshot | null

    if (hospitalId) {
      appointmentRef = firestore
        .collection(getHospitalCollectionPath(hospitalId, "appointments"))
        .doc(appointmentId)
      appointmentDoc = await appointmentRef.get()
    }

    // Fallback to legacy global collection if not found or no hospitalId
    if (!appointmentDoc || !appointmentDoc.exists) {
      appointmentRef = firestore.collection("appointments").doc(appointmentId)
      appointmentDoc = await appointmentRef.get()
    }

    if (!appointmentDoc.exists) {
      return Response.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    const appointmentData = appointmentDoc.data()!

    // Validate that this is a WhatsApp booking
    if (!appointmentData.whatsappPending && appointmentData.status !== "whatsapp_pending") {
      return Response.json(
        { error: "This appointment is not a WhatsApp pending booking" },
        { status: 400 }
      )
    }

    // Delete associated appointment slot if exists
    const appointmentDate = appointmentData.appointmentDate
    const appointmentTime = appointmentData.appointmentTime
    
    if (appointmentDate && appointmentTime) {
      const { normalizeTime } = await import("@/utils/timeSlots")
      const normalizedTime = normalizeTime(appointmentTime)
      
      // Delete PENDING slot if exists
      const pendingSlotId = `PENDING_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
      const pendingSlotRef = firestore.collection("appointmentSlots").doc(pendingSlotId)
      const pendingSlotDoc = await pendingSlotRef.get()
      
      if (pendingSlotDoc.exists && pendingSlotDoc.data()?.appointmentId === appointmentId) {
        await pendingSlotRef.delete()
      }
      
      // Delete doctor slot if exists
      if (appointmentData.doctorId) {
        const doctorSlotId = `${appointmentData.doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
        const doctorSlotRef = firestore.collection("appointmentSlots").doc(doctorSlotId)
        const doctorSlotDoc = await doctorSlotRef.get()
        
        if (doctorSlotDoc.exists && doctorSlotDoc.data()?.appointmentId === appointmentId) {
          await doctorSlotRef.delete()
        }
      }
    }

    // Delete the appointment
    if (!appointmentRef) {
      throw new Error("Internal error: appointmentRef not initialized")
    }

    await appointmentRef.delete()

    return Response.json({
      success: true,
      message: "WhatsApp booking deleted successfully"
    })
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || "Unknown error occurred"
    return Response.json(
      { 
        error: "Failed to delete WhatsApp booking", 
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

