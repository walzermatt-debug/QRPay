import QRCode from "qrcode";

/** Renders a URL as a QR code PNG data URL for inline <img> use. */
export function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 320 });
}

export function payUrlForSpot(qrToken: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/pay/${qrToken}`;
}
