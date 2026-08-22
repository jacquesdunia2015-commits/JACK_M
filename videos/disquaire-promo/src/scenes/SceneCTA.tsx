import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { bodyFont, headlineFont } from "../fonts";

export const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="CTA background"
      style={{
        backgroundColor: "#f3e6c8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="CTA store name"
        style={{
          fontFamily: headlineFont,
          fontSize: 128,
          letterSpacing: 5,
          color: "#c1461f",
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0, 0.7 * fps], [0.9, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
        }}
      >
        LE SILLON
      </Interactive.Div>

      <Interactive.Div
        name="CTA tagline"
        style={{
          fontFamily: bodyFont,
          fontWeight: 400,
          fontSize: 46,
          fontStyle: "italic",
          color: "#1c1712",
          marginTop: 20,
          marginBottom: 56,
          opacity: interpolate(frame, [0.7 * fps, 1.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Le son qui a une âme.
      </Interactive.Div>

      <Interactive.Div
        name="CTA details"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity: interpolate(frame, [1.5 * fps, 2.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Interactive.Div
          name="CTA hours"
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 38,
            letterSpacing: 1,
            color: "#1c1712",
          }}
        >
          Du mardi au samedi · 10h – 19h
        </Interactive.Div>
        <Interactive.Div
          name="CTA location"
          style={{
            fontFamily: bodyFont,
            fontWeight: 400,
            fontSize: 34,
            letterSpacing: 1,
            color: "#8a5a2b",
          }}
        >
          En plein centre-ville
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="CTA closing line"
        style={{
          width: 160,
          height: 4,
          backgroundColor: "#dba43f",
          marginTop: 48,
          scale: interpolate(
            frame,
            [durationInFrames - 0.8 * fps, durationInFrames - 0.2 * fps],
            [1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              output: "perceptual-scale",
            },
          ),
        }}
      />
    </AbsoluteFill>
  );
};
