/**
 * CUSTOMER RESPONSE ANALYSIS — client-safe, deterministik (Phase 6).
 *
 * Membaca teks respons customer (WhatsApp, email, catatan sales, catatan
 * konsultasi, catatan CRM, ringkasan chatbot) dan menurunkannya menjadi:
 *   - temuan bisnis (fakta bila customer menyatakan kondisi nyata, dugaan
 *     bila hanya minat/rencana), dan
 *   - keberatan customer beserta kategorinya.
 *
 * Modul ini netral industri: tidak ada kosakata kuliner atau asumsi jenis
 * usaha tertentu. Tidak ada AI di sini — hasilnya bisa diuji dan diaudit.
 */

export type ResponseChannel =
  | "whatsapp"
  | "email"
  | "sales_note"
  | "consultation_note"
  | "crm_note"
  | "chatbot";

export const RESPONSE_CHANNEL_LABELS: Record<ResponseChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sales_note: "Catatan sales",
  consultation_note: "Catatan konsultasi",
  crm_note: "Catatan CRM",
  chatbot: "Percakapan AI",
};

export type FindingPolarity = "has" | "lacks" | "interest";

export type DetectedFinding = {
  topicKey: string;
  kind: "fact" | "hypothesis";
  polarity: FindingPolarity;
  statement: string;
  confidence: number;
};

export type DetectedObjection = {
  category: string;
  quote: string;
  confidence: number;
};

export type ResponseAnalysis = {
  findings: DetectedFinding[];
  objections: DetectedObjection[];
  /** true bila respons ini mengubah pemahaman bisnis (memicu analisis ulang). */
  significant: boolean;
};

type Topic = { key: string; label: string; pattern: RegExp };

/** Topik operasional umum — berlaku untuk semua jenis usaha. */
const TOPICS: Topic[] = [
  { key: "booking_system", label: "sistem booking / jadwal janji", pattern: /\b(booking|reservasi|janji temu|jadwal pelanggan|appointment)\b/i },
  { key: "website", label: "website", pattern: /\b(website|web|situs|landing page)\b/i },
  { key: "internal_system", label: "sistem internal / aplikasi operasional", pattern: /\b(aplikasi|sistem|software|pos|kasir|erp)\b/i },
  { key: "chat_handling", label: "penanganan chat pelanggan", pattern: /\b(chat|whatsapp|wa|balas pesan|admin balas)\b/i },
  { key: "reporting", label: "laporan dan dashboard", pattern: /\b(laporan|report|dashboard|rekap|pembukuan)\b/i },
  { key: "inventory", label: "pencatatan stok", pattern: /\b(stok|stock|inventori|inventory|gudang)\b/i },
  { key: "order_management", label: "pengelolaan pesanan", pattern: /\b(pesanan|order|orderan|transaksi)\b/i },
  { key: "customer_followup", label: "follow up pelanggan", pattern: /\b(follow ?up|crm|database pelanggan|pelanggan kembali|retensi)\b/i },
  { key: "team_management", label: "pengelolaan tim", pattern: /\b(karyawan|staf|staff|tim|absensi|shift)\b/i },
  { key: "payment", label: "pembayaran dan tagihan", pattern: /\b(pembayaran|bayar|invoice|tagihan|payment)\b/i },
  { key: "service_tracking", label: "pemantauan status pengerjaan", pattern: /\b(status pengerjaan|progress|tracking|antrian|antrean)\b/i },
];

const HAS = /\b(sudah|udah|telah|saat ini (pakai|menggunakan)|sedang (pakai|menggunakan)|punya|memakai|menggunakan)\b/i;
const LACKS = /\b(belum|tidak punya|ga punya|gak punya|nggak punya|masih manual|belum ada|tanpa)\b/i;
const INTEREST = /\b(ingin|mau|butuh|perlu|tertarik|rencana|berencana|pengen|kepikiran)\b/i;

type ObjectionRule = { category: string; pattern: RegExp; confidence: number };

const OBJECTIONS: ObjectionRule[] = [
  { category: "sudah_punya_solusi", pattern: /\b(sudah|udah|telah)\b.{0,24}\b(punya|pakai|memakai|menggunakan|ada)\b/i, confidence: 80 },
  { category: "belum_butuh", pattern: /\b(belum (butuh|perlu|kepikiran)|tidak (butuh|perlu)|ga perlu|gak perlu|nggak perlu)\b/i, confidence: 85 },
  { category: "harga", pattern: /\b(mahal|kemahalan|budget|anggaran|biaya(nya)? berapa|harga(nya)? berapa)\b/i, confidence: 75 },
  { category: "waktu", pattern: /\b(nanti|belum sempat|lagi sibuk|bulan depan|tahun depan|tunda)\b/i, confidence: 70 },
  { category: "keputusan_pihak_lain", pattern: /\b(tanya (dulu )?(owner|atasan|bos|partner|suami|istri)|keputusan (owner|pusat)|rapat dulu)\b/i, confidence: 75 },
  { category: "kepercayaan", pattern: /\b(ragu|takut|pernah kecewa|pernah gagal|khawatir|penipuan)\b/i, confidence: 70 },
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function statementFor(topic: Topic, polarity: FindingPolarity): string {
  if (polarity === "has") return `Sudah memiliki ${topic.label}`;
  if (polarity === "lacks") return `Belum memiliki ${topic.label}`;
  return `Kemungkinan membutuhkan ${topic.label}`;
}

function polarityOf(sentence: string): FindingPolarity | null {
  const lacks = LACKS.test(sentence);
  const has = HAS.test(sentence);
  // "belum" mengalahkan "sudah" pada kalimat seperti "sudah lama tapi belum punya".
  if (lacks) return "lacks";
  if (has) return "has";
  if (INTEREST.test(sentence)) return "interest";
  return null;
}

/** Turunkan temuan dan keberatan dari satu respons customer. */
export function analyzeCustomerResponse(text: string, channel: ResponseChannel): ResponseAnalysis {
  const clean = (text ?? "").trim();
  if (!clean) return { findings: [], objections: [], significant: false };

  const byTopic = new Map<string, DetectedFinding>();
  for (const sentence of sentences(clean)) {
    const polarity = polarityOf(sentence);
    if (!polarity) continue;
    for (const topic of TOPICS) {
      if (!topic.pattern.test(sentence)) continue;
      const kind = polarity === "interest" ? "hypothesis" : "fact";
      // Pernyataan langsung dari customer lebih tinggi keyakinannya daripada
      // catatan internal yang ditulis ulang oleh sales.
      const base = channel === "sales_note" || channel === "crm_note" ? 70 : 85;
      const confidence = kind === "fact" ? base : Math.max(40, base - 30);
      const existing = byTopic.get(topic.key);
      if (existing && existing.confidence >= confidence && existing.kind === "fact") continue;
      byTopic.set(topic.key, {
        topicKey: topic.key,
        kind,
        polarity,
        statement: statementFor(topic, polarity),
        confidence,
      });
    }
  }

  const objections: DetectedObjection[] = [];
  for (const sentence of sentences(clean)) {
    for (const rule of OBJECTIONS) {
      if (!rule.pattern.test(sentence)) continue;
      if (objections.some((o) => o.category === rule.category)) continue;
      objections.push({ category: rule.category, quote: sentence.slice(0, 240), confidence: rule.confidence });
    }
  }

  const findings = [...byTopic.values()];
  return {
    findings,
    objections,
    significant: findings.some((f) => f.kind === "fact"),
  };
}

export const OBJECTION_LABELS: Record<string, string> = {
  sudah_punya_solusi: "Sudah punya solusi",
  belum_butuh: "Belum merasa butuh",
  harga: "Pertimbangan biaya",
  waktu: "Belum waktunya",
  keputusan_pihak_lain: "Keputusan pihak lain",
  kepercayaan: "Perlu kepercayaan",
};

export function objectionLabel(category: string): string {
  return OBJECTION_LABELS[category] ?? category;
}
