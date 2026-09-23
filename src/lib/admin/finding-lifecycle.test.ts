import { describe, expect, it } from "vitest";

import { planFindingLifecycle, type ExistingFinding } from "@/lib/admin/finding-lifecycle";
import { analyzeCustomerResponse } from "@/lib/admin/response-analysis";

describe("customer response analysis", () => {
  it("membaca fakta 'sudah punya' dari jawaban customer", () => {
    const result = analyzeCustomerResponse("Kami sudah menggunakan aplikasi booking sejak tahun lalu.", "whatsapp");
    const booking = result.findings.find((f) => f.topicKey === "booking_system");
    expect(booking?.kind).toBe("fact");
    expect(booking?.statement).toMatch(/Sudah memiliki/);
    expect(result.significant).toBe(true);
  });

  it("membaca fakta 'belum punya' dan keberatan biaya", () => {
    const result = analyzeCustomerResponse("Kami belum punya website. Tapi budget kami terbatas.", "whatsapp");
    expect(result.findings.some((f) => f.statement === "Belum memiliki website")).toBe(true);
    expect(result.objections.some((o) => o.category === "harga")).toBe(true);
  });

  it("minat customer hanya menjadi dugaan, bukan fakta", () => {
    const result = analyzeCustomerResponse("Kami tertarik dengan laporan penjualan otomatis.", "whatsapp");
    expect(result.findings[0]?.kind).toBe("hypothesis");
    expect(result.significant).toBe(false);
  });

  it("tidak mengandung kosakata industri tertentu", () => {
    const result = analyzeCustomerResponse("Kami belum punya sistem antrian pelanggan.", "sales_note");
    for (const finding of result.findings) {
      expect(finding.statement.toLowerCase()).not.toMatch(/menu|resto|kuliner|makanan/);
    }
  });
});

describe("finding lifecycle", () => {
  const existing: ExistingFinding[] = [
    {
      id: "f1",
      topicKey: "booking_system",
      kind: "hypothesis",
      statement: "Kemungkinan membutuhkan sistem booking / jadwal janji",
      validationStatus: "unvalidated",
    },
  ];

  it("menolak dugaan lama ketika customer membantah, lalu menambah fakta baru", () => {
    const detected = analyzeCustomerResponse("Kami sudah pakai aplikasi booking.", "whatsapp").findings;
    const plan = planFindingLifecycle(existing, detected);
    expect(plan.reject).toHaveLength(1);
    expect(plan.reject[0]?.id).toBe("f1");
    expect(plan.insert.some((i) => i.validationStatus === "confirmed")).toBe(true);
    expect(plan.staleReason).toBeTruthy();
  });

  it("tidak menduplikasi fakta yang sudah terkonfirmasi", () => {
    const confirmed: ExistingFinding[] = [
      {
        id: "f2",
        topicKey: "website",
        kind: "fact",
        statement: "Belum memiliki website",
        validationStatus: "confirmed",
      },
    ];
    const detected = analyzeCustomerResponse("Kami belum punya website.", "whatsapp").findings;
    const plan = planFindingLifecycle(confirmed, detected);
    expect(plan.insert).toHaveLength(0);
    expect(plan.staleReason).toBeNull();
  });

  it("aktivitas CRM biasa tanpa informasi baru tidak membuat analisis kedaluwarsa", () => {
    const detected = analyzeCustomerResponse("Sudah saya telepon, belum diangkat.", "crm_note").findings;
    const plan = planFindingLifecycle([], detected);
    expect(plan.staleReason).toBeNull();
  });
});
