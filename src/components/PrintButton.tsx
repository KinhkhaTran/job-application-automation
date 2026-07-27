"use client";

import { Printer } from "./icons";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost no-print">
      <Printer width={15} height={15} />
      Export PDF
    </button>
  );
}
