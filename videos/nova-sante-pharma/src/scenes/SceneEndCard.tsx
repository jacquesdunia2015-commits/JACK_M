import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brandFont } from "../fonts";
import { BrandMark } from "../BrandMark";

export const SceneEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="End card background"
      style={{
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="End brand mark"
        style={{
          scale: interpolate(frame, [0, 0.6 * fps], [0.8, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <BrandMark size={130} />
      </Interactive.Div>

      <Interactive.Div
        name="End wordmark"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "baseline",
          gap: 18,
          marginTop: 22,
          opacity: interpolate(frame, [0.4 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Interactive.Div
          name="End NOVA"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 82,
            color: "#0d3b66",
          }}
        >
          NOVA
        </Interactive.Div>
        <Interactive.Div
          name="End SANTE"
          style={{
            fontFamily: brandFont,
            fontWeight: 700,
            fontSize: 82,
            color: "#1f9d55",
          }}
        >
          SANTÉ
        </Interactive.Div>
      </Interactive.Div>
      <Interactive.Div
        name="End PHARMA"
        style={{
          fontFamily: brandFont,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: 12,
          color: "#0d3b66",
          marginTop: 2,
          opacity: interpolate(frame, [0.6 * fps, 1.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        PHARMA
      </Interactive.Div>

      <Interactive.Div
        name="End tagline"
        style={{
          fontFamily: brandFont,
          fontWeight: 400,
          fontStyle: "italic",
          fontSize: 40,
          color: "#1f9d55",
          marginTop: 30,
          opacity: interpolate(frame, [1.2 * fps, 1.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Votre santé, notre priorité.
      </Interactive.Div>

      <Interactive.Div
        name="End location"
        style={{
          fontFamily: brandFont,
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: 4,
          color: "#5b6b78",
          marginTop: 26,
          opacity: interpolate(frame, [1.9 * fps, 2.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        BUKAVU · SUD-KIVU · RDC
      </Interactive.Div>

      <Interactive.Div
        name="End closing line"
        style={{
          width: 160,
          height: 4,
          backgroundColor: "#1f9d55",
          marginTop: 40,
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
