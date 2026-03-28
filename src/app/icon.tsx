import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "linear-gradient(135deg, #8a63ff 0%, #5e3de8 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
        <rect x="1" y="4" width="7" height="1.5" rx="0.75" fill="white" opacity="0.95" />
        <rect x="1" y="7.5" width="5" height="1.5" rx="0.75" fill="white" opacity="0.6" />
        <circle cx="11" cy="6.5" r="1.5" fill="white" opacity="0.9" />
      </svg>
    </div>,
    { ...size },
  );
}
