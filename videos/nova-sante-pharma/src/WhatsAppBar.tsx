import { AbsoluteFill, Interactive } from "remotion";
import { brandFont } from "./fonts";

// Bandeau de contact WhatsApp permanent : visible dès l'image 0 et jusqu'à
// la toute dernière image de la vidéo, en surimpression sur chaque scène.
export const WhatsAppBar: React.FC = () => {
  return (
    <AbsoluteFill
      name="WhatsApp bar layer"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <Interactive.Div
        name="WhatsApp bar"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          width: 1920,
          height: 132,
          backgroundColor: "#128c4a",
          boxShadow: "0px -6px 18px rgba(0,0,0,.18)",
        }}
      >
        <svg width="56" height="56" viewBox="0 0 34 34" style={{ flexShrink: 0 }}>
          <path
            d="M17 4a13 13 0 0 0-11 20l-2 8 8-2a13 13 0 1 0 5-26z"
            fill="#ffffff"
          />
        </svg>
        <Interactive.Div
          name="WhatsApp bar label"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: 3,
            color: "#c8f0d8",
          }}
        >
          WHATSAPP
        </Interactive.Div>
        <Interactive.Div
          name="WhatsApp bar number"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 62,
            color: "#ffffff",
          }}
        >
          +243 999 870 833
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
