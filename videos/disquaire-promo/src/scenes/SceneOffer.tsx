import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { bodyFont, headlineFont } from "../fonts";

export const SceneOffer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Offer background"
      style={{
        backgroundColor: "#c1461f",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingLeft: 160,
        paddingRight: 160,
        gap: 44,
      }}
    >
      <Interactive.Div
        name="Offer heading"
        style={{
          fontFamily: headlineFont,
          fontSize: 96,
          letterSpacing: 3,
          color: "#f3e6c8",
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        POURQUOI LE SILLON ?
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 1"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 26,
          opacity: interpolate(frame, [0.6 * fps, 1.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [0.6 * fps, 1.2 * fps],
            ["0px 24px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        <Interactive.Div
          name="Bullet 1"
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            backgroundColor: "#f3e6c8",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 1"
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 54,
            color: "#f3e6c8",
          }}
        >
          Écoute avant achat, en boutique
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 2"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 26,
          opacity: interpolate(frame, [1.3 * fps, 1.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [1.3 * fps, 1.9 * fps],
            ["0px 24px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        <Interactive.Div
          name="Bullet 2"
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            backgroundColor: "#f3e6c8",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 2"
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 54,
            color: "#f3e6c8",
          }}
        >
          Occasions triées et éditions rares
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 3"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 26,
          opacity: interpolate(frame, [2.0 * fps, 2.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [2.0 * fps, 2.6 * fps],
            ["0px 24px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        <Interactive.Div
          name="Bullet 3"
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            backgroundColor: "#f3e6c8",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 3"
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 54,
            color: "#f3e6c8",
          }}
        >
          Nouveautés chaque semaine
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
