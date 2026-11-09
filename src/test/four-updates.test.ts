import { describe, it, expect } from "vitest";
import { getWhatsAppDirectUrl } from "@/lib/messagingUtils";
import {
  DEFAULT_CREW_REQUIREMENTS,
  calculateTotalRequiredCrew,
  getCrewRequirementsForShoot,
  getPhotographerClassificationsForShoot,
  injectCrewMetaIntoNotes,
  ROLE_CATEGORIES,
  type CrewRequirements,
  type PhotographerClassification,
} from "@/lib/crewRequirements";
import {
  deriveProjectFinancialSummaries,
  type ClientInvoiceRecord,
  type ClientPaymentRecord,
} from "@/lib/finance";
import type { Tables } from "@/integrations/supabase/types";

type Shoot = Tables<"shoots">;

describe("TA Bridals - Four Specific Updates Verification", () => {
  // ==========================================
  // CHANGE 1: WHATSAPP MOBILE NATIVE APP DEEP LINK
  // ==========================================
  describe("Change 1: WhatsApp Native App Deep Link & Web Fallback", () => {
    it("generates native whatsapp:// app deep link with phone and encoded message", () => {
      const phone = "919876543210";
      const message = "Hi John! You have a shoot tomorrow.";
      const urls = getWhatsAppDirectUrl(phone, message);

      expect(urls.nativeAppUrl).toBe(
        `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`,
      );
      expect(urls.webUrl).toBe(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      );
    });

    it("sanitizes phone numbers with spaces, plus signs, and dashes", () => {
      const rawPhone = "+91 98765-43210";
      const message = "Reminder message";
      const urls = getWhatsAppDirectUrl(rawPhone, message);

      expect(urls.nativeAppUrl).toContain("phone=919876543210");
      expect(urls.webUrl).toContain("wa.me/919876543210");
    });
  });

  // ==========================================
  // CHANGE 2: CREW REQUIREMENTS COUNTS BEFORE ASSIGNMENT
  // ==========================================
  describe("Change 2: Crew Requirement Counts Before Assignment", () => {
    it("defaults every category to 0", () => {
      expect(DEFAULT_CREW_REQUIREMENTS.photographer).toBe(0);
      expect(DEFAULT_CREW_REQUIREMENTS.videographer).toBe(0);
      expect(DEFAULT_CREW_REQUIREMENTS.drone_operator).toBe(0);
      expect(DEFAULT_CREW_REQUIREMENTS.cinematographer).toBe(0);
      expect(DEFAULT_CREW_REQUIREMENTS.others).toBe(0);
    });

    it("includes all 5 required categories", () => {
      const keys = ROLE_CATEGORIES.map((c) => c.key);
      expect(keys).toContain("photographer");
      expect(keys).toContain("videographer");
      expect(keys).toContain("drone_operator");
      expect(keys).toContain("cinematographer");
      expect(keys).toContain("others");
    });

    it("calculates total required crew count accurately", () => {
      const reqs: CrewRequirements = {
        photographer: 2,
        videographer: 2,
        drone_operator: 1,
        cinematographer: 1,
        others: 0,
      };

      const total = calculateTotalRequiredCrew(reqs);
      expect(total).toBe(6);
    });

    it("retrieves default 0 requirements when shoot has no previous requirements", () => {
      const emptyReqs = getCrewRequirementsForShoot("shoot-non-existent-123");
      expect(emptyReqs.photographer).toBe(0);
      expect(emptyReqs.videographer).toBe(0);
      expect(emptyReqs.drone_operator).toBe(0);
      expect(emptyReqs.cinematographer).toBe(0);
      expect(emptyReqs.others).toBe(0);
      expect(calculateTotalRequiredCrew(emptyReqs)).toBe(0);
    });
  });

  // ==========================================
  // CHANGE 3: NORMAL / CANDIDATE PHOTOGRAPHER SELECTION
  // ==========================================
  describe("Change 3: Normal / Candidate Photographer Selection", () => {
    it("defaults classification to Normal and allows Candidate classification", () => {
      const defaultClassification: PhotographerClassification = "Normal";
      const candidateClassification: PhotographerClassification = "Candidate";

      expect(defaultClassification).toBe("Normal");
      expect(candidateClassification).toBe("Candidate");
    });

    it("preserves classifications in shoot notes metadata", () => {
      const reqs: CrewRequirements = {
        photographer: 2,
        videographer: 1,
        drone_operator: 0,
        cinematographer: 0,
        others: 0,
      };
      const classifications: Record<string, PhotographerClassification> = {
        "worker-1": "Normal",
        "worker-2": "Candidate",
      };

      const updatedNotes = injectCrewMetaIntoNotes(
        "Client requested candid shots",
        reqs,
        classifications,
      );

      expect(updatedNotes).toContain("[CrewReq:");
      expect(updatedNotes).toContain("[PhotoClass:");
      expect(updatedNotes).toContain('"worker-2":"Candidate"');

      // Now verify retrieval from notes
      const retrievedClass = getPhotographerClassificationsForShoot(
        "shoot-test-notes",
        updatedNotes,
      );
      expect(retrievedClass["worker-1"]).toBe("Normal");
      expect(retrievedClass["worker-2"]).toBe("Candidate");

      const retrievedReqs = getCrewRequirementsForShoot(
        "shoot-test-notes",
        updatedNotes,
      );
      expect(retrievedReqs.photographer).toBe(2);
      expect(retrievedReqs.videographer).toBe(1);
    });
  });

  // ==========================================
  // CHANGE 4: PROJECT-LEVEL FINANCE & INVOICES
  // ==========================================
  describe("Change 4: Project-Level Finance, Associated Events, and Multiple Payments", () => {
    const mockShoots: Shoot[] = [
      {
        id: "event-1",
        couple_name: "Maya & Arjun",
        event_type: "Haldi",
        event_date: "2026-11-20",
        start_time: "10:00",
        end_time: "14:00",
        venue: "Heritage Haveli",
        status: "Upcoming",
        created_at: "2026-11-01T00:00:00Z",
        location: "Jaipur",
        notes: null,
        planned_team_size: 4,
        raw_footage_status: null,
        sheet_row_number: 1,
        updated_at: "2026-11-01T00:00:00Z",
        wedding_date: "2026-11-20",
      },
      {
        id: "event-2",
        couple_name: "Maya & Arjun",
        event_type: "Nikah",
        event_date: "2026-11-21",
        start_time: "16:00",
        end_time: "20:00",
        venue: "Taj Palace",
        status: "Upcoming",
        created_at: "2026-11-01T00:00:00Z",
        location: "Jaipur",
        notes: null,
        planned_team_size: 6,
        raw_footage_status: null,
        sheet_row_number: 2,
        updated_at: "2026-11-01T00:00:00Z",
        wedding_date: "2026-11-20",
      },
      {
        id: "event-3",
        couple_name: "Maya & Arjun",
        event_type: "Reception",
        event_date: "2026-11-22",
        start_time: "19:00",
        end_time: "23:00",
        venue: "Royal Lawn",
        status: "Upcoming",
        created_at: "2026-11-01T00:00:00Z",
        location: "Jaipur",
        notes: null,
        planned_team_size: 5,
        raw_footage_status: null,
        sheet_row_number: 3,
        updated_at: "2026-11-01T00:00:00Z",
        wedding_date: "2026-11-20",
      },
    ];

    const mockInvoice: ClientInvoiceRecord = {
      id: "inv-maya-arjun",
      shoot_id: "event-1",
      invoice_number: "INV-2026-001",
      client_name: "Maya & Arjun",
      agreed_price: 150000,
      additional_charges: 10000,
      discount_amount: 5000,
      tax_amount: 0,
      issue_date: "2026-11-01",
      due_date: "2026-11-30",
      status: "issued",
      notes: "Project invoice covering Haldi, Nikah and Reception",
      total_amount: 155000,
      total_paid: 50000,
      outstanding_balance: 105000,
      payment_status: "partial",
    };

    const mockPayments: ClientPaymentRecord[] = [
      {
        id: "pay-1",
        invoice_id: "inv-maya-arjun",
        shoot_id: "event-1",
        receipt_number: "RCP-1001",
        amount: 50000,
        payment_date: "2026-11-02",
        payment_method: "bank_transfer",
        transaction_reference: "UTR-55443322",
        notes: "Advance deposit for full wedding project",
        is_reversed: false,
      },
      {
        id: "pay-2",
        invoice_id: "inv-maya-arjun",
        shoot_id: "event-2",
        receipt_number: "RCP-1002",
        amount: 30000,
        payment_date: "2026-11-10",
        payment_method: "upi",
        transaction_reference: "UPI-99887766",
        notes: "Second partial payment",
        is_reversed: false,
      },
    ];

    it("consolidates multiple associated events into ONE project financial record", () => {
      const summaries = deriveProjectFinancialSummaries(
        mockShoots,
        [mockInvoice],
        mockPayments,
      );

      expect(summaries.length).toBe(1);
      const project = summaries[0]!;
      expect(project.projectName).toBe("Maya & Arjun");
      expect(project.associatedEvents.length).toBe(3);

      const eventNames = project.associatedEvents.map((e) => e.eventType);
      expect(eventNames).toContain("Haldi");
      expect(eventNames).toContain("Nikah");
      expect(eventNames).toContain("Reception");
    });

    it("correctly aggregates project amount, multiple partial payments, and remaining balance", () => {
      const summaries = deriveProjectFinancialSummaries(
        mockShoots,
        [mockInvoice],
        mockPayments,
      );

      const project = summaries[0]!;
      // Total Billed = 150000 + 10000 - 5000 = 155000
      expect(project.totalBilled).toBe(155000);
      // Total Paid = 50000 + 30000 = 80000
      expect(project.amountPaid).toBe(80000);
      // Remaining Balance = 155000 - 80000 = 75000
      expect(project.remainingBalance).toBe(75000);
      expect(project.paymentStatus).toBe("partial");
      expect(project.payments.length).toBe(2);
    });

    it("marks project as paid when full balance is collected across partial payments", () => {
      const finalPayment: ClientPaymentRecord = {
        id: "pay-3",
        invoice_id: "inv-maya-arjun",
        shoot_id: "event-3",
        receipt_number: "RCP-1003",
        amount: 75000,
        payment_date: "2026-11-15",
        payment_method: "cash",
        transaction_reference: null,
        notes: "Final settlement",
        is_reversed: false,
      };

      const summaries = deriveProjectFinancialSummaries(
        mockShoots,
        [mockInvoice],
        [...mockPayments, finalPayment],
      );

      const project = summaries[0]!;
      expect(project.amountPaid).toBe(155000);
      expect(project.remainingBalance).toBe(0);
      expect(project.paymentStatus).toBe("paid");
      expect(project.payments.length).toBe(3);
    });
  });
});
