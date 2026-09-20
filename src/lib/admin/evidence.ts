/**
 * Evidence panel — client-safe.
 *
 * Every fact shown to a sales agent carries where it came from and how sure
 * we are. Nothing here is invented: each row is built from a stored field.
 */
import type { QualificationInput } from "@/lib/admin/qualification";

export type EvidenceItem = {
  field: string;
  data: string;
  source: string;
  source_url: string | null;
  confidence: number;
};

function mapsSource(input: QualificationInput): string {
  return input.placeId || input.googleMapsUrl ? "Google Maps" : "Data penemuan";
}

/** Builds the data -> source -> confidence list stored with each preparation. */
export function buildEvidence(input: QualificationInput): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const source = mapsSource(input);
  const mapsUrl = input.googleMapsUrl ?? null;

  items.push({
    field: "Nama bisnis",
    data: input.businessName,
    source,
    source_url: mapsUrl,
    confidence: input.placeId ? 95 : 70,
  });

  items.push({
    field: "Kategori",
    data: input.category ?? input.industry ?? "Tidak diketahui",
    source: input.category ? source : "Belum ada data",
    source_url: input.category ? mapsUrl : null,
    confidence: input.category ? 85 : 30,
  });

  const location = [input.address, input.city, input.province].filter(Boolean).join(", ");
  items.push({
    field: "Lokasi",
    data: location || "Tidak diketahui",
    source: location ? source : "Belum ada data",
    source_url: location ? mapsUrl : null,
    confidence: input.address ? 90 : input.city ? 65 : 25,
  });

  if (input.rating != null || input.reviewCount != null) {
    items.push({
      field: "Rating & ulasan",
      data: `${input.rating ?? "—"} / ${input.reviewCount ?? 0} ulasan`,
      source,
      source_url: mapsUrl,
      confidence: 90,
    });
  }

  items.push({
    field: "Website",
    data:
      input.websiteStatus === "present"
        ? (input.website ?? "Tersedia")
        : input.websiteStatus === "missing"
          ? "Tidak ditemukan"
          : "Belum diperiksa",
    source: input.websiteStatus === "unknown" ? "Belum diperiksa" : `Pengecekan ${source}`,
    source_url: input.website ?? null,
    confidence: input.websiteStatus === "unknown" ? 30 : 90,
  });

  const contacts = input.contactData ?? {};
  for (const [channel, entry] of Object.entries(contacts)) {
    if (!entry?.value) continue;
    items.push({
      field: channel === "phone" ? "Nomor telepon / WhatsApp" : channel,
      data: String(entry.value),
      source: entry.source ? String(entry.source) : "Tanpa sumber",
      source_url: (entry as { source_url?: string | null }).source_url ?? null,
      confidence: entry.source ? 85 : 35,
    });
  }

  if (!Object.values(contacts).some((entry) => entry?.value) && input.phone) {
    items.push({
      field: "Nomor telepon / WhatsApp",
      data: input.phone,
      source: "Tanpa sumber tercatat",
      source_url: null,
      confidence: 35,
    });
  }

  return items;
}
