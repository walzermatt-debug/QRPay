"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-8 rounded-md bg-neutral-900 px-6 py-3 font-medium text-white hover:bg-neutral-800 print:hidden"
    >
      Print
    </button>
  );
}
