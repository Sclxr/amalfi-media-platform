import { ImageResponse } from "next/og";

export const alt = "Amalfi Media";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#111111",
          color: "#F7F5F0",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: "0.28em", color: "#D4BC8C" }}>AMALFI MEDIA</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 72, fontWeight: 650, lineHeight: 1.05 }}>
          Orlando real estate photography
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#BDB7AE" }}>Galleries, payments, and downloads</div>
      </div>
    ),
    { ...size },
  );
}
