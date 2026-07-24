import QRCode from "qrcode";

/** Renders a URL as a QR code PNG data URL for inline <img> use. */
export function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 320 });
}

export function payUrlForSpot(qrToken: string, baseUrl: string): string {
  return `${baseUrl}/pay/${qrToken}`;
}
