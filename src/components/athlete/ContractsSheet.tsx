"use client";

// Contracts sheet (Phase 3). Lists the athlete's own signed `contracts` rows.
// VIEW PDF opens a short-lived signed Storage URL via the service route
// /api/athlete/contracts/[id]/pdf (only when a pdf_storage_path exists). Zero
// rows keeps the honest empty state.

import AthleteSheet from "@/components/athlete/AthleteSheet";
import { formatLongDate } from "@/lib/athlete-format";
import type { ContractRow } from "@/lib/athlete-account";

export default function ContractsSheet({
  open,
  onClose,
  contracts,
}: {
  open: boolean;
  onClose: () => void;
  contracts: ContractRow[];
}) {
  return (
    <AthleteSheet open={open} onClose={onClose} title="Contracts" subtitle="Your signed deal paperwork, in one place.">
      {contracts.length === 0 ? (
        <div className="a-sheet-empty">Contracts you sign through Postgame will be stored here.</div>
      ) : (
        <div>
          {contracts.map((c) => {
            const meta = [c.contractType, c.signedAt ? `Signed ${formatLongDate(c.signedAt)}` : "Signed"]
              .filter(Boolean)
              .join(" · ");
            return (
              <div className="a-crow" key={c.id}>
                <div className="cbody">
                  <div className="ctitle">{c.title}</div>
                  <div className="cmeta">{meta}</div>
                </div>
                {c.hasPdf ? (
                  <a
                    className="a-viewpdf"
                    href={`/api/athlete/contracts/${c.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View PDF
                  </a>
                ) : (
                  <span className="a-viewpdf disabled">PDF pending</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AthleteSheet>
  );
}
