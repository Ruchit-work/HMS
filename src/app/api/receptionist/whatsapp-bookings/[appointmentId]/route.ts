import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { NextRequest } from "next/server"
import { sendWhatsAppNotification } from "@/server/whatsapp"

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
    const body = await request.json()

    const firestore = admin.firestore()
    const appointmentRef = firestore.collection("appointments").doc(appointmentId)
    const appointmentDoc = await appointmentRef.get()

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
        
        // Check if the new slot is available (unless it's for this same appointment)
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
          
          // Read old PENDING slot
          const oldPendingSlotId = `PENDING_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
          const oldPendingSlotRef = firestore.collection("appointmentSlots").doc(oldPendingSlotId)
          const oldPendingSlotSnap = await transaction.get(oldPendingSlotRef)
          
          // Read old doctor slot (if doctor is being changed)
          let oldDoctorSlotRef = null
          let oldDoctorSlotSnap = null
          if (appointmentData.doctorId && appointmentData.doctorId !== body.doctorId) {
            const oldDoctorSlotId = `${appointmentData.doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
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
          
          if (oldPendingSlotSnap.exists && oldPendingSlotSnap.data()?.appointmentId === appointmentId) {
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

    // Update status - if doctor is assigned, always mark as confirmed so it appears in appointment lists
    // This ensures appointments show up for doctors regardless of billing status
    let shouldSendNotification = false
    if (updateData.doctorId && body.markConfirmed !== false) {
      // Always mark as confirmed when receptionist assigns doctor and saves
      // This makes the appointment visible in doctor's dashboard regardless of payment status
      updateData.status = "confirmed"
      updateData.whatsappPending = false
      shouldSendNotification = true // Send WhatsApp notification to patient
    } else if (updateData.doctorId) {
      // Even if markConfirmed is false, still mark as confirmed when doctor is assigned
      // Real-world scenario: patients often pay after checkup or through different methods
      updateData.status = "confirmed"
      updateData.whatsappPending = false
      // Don't send notification if markConfirmed is explicitly false
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
      } catch (patientUpdateError) {
        console.error("[Receptionist Update] Error updating patient record:", patientUpdateError)
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
            console.error("[WhatsApp Bookings API] ❌ Failed to send confirmation message:", {
              phone: patientPhone,
              error: result.error,
              errorCode: result.errorCode,
            })
          }
        } else {
          console.warn("[WhatsApp Bookings API] ⚠️ No phone number found, WhatsApp notification not sent. Patient:", patientName)
        }
      } catch (whatsappError: any) {
        console.error("[WhatsApp Bookings API] ❌ Error sending WhatsApp notification:", whatsappError)
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
    console.error("[WhatsApp Bookings API] Error updating booking:", error)
    if (error.message === "SLOT_ALREADY_BOOKED") {
      return Response.json(
        { error: "Time slot is already booked" },
        { status: 400 }
      )
    }
    return Response.json(
      { error: "Failed to update WhatsApp booking", details: error.message },
      { status: 500 }
    )
  }
}

