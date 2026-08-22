import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brandFont } from "../fonts";

export const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Features background"
      style={{
        backgroundColor: "#1f9d55",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingLeft: 220,
        gap: 38,
      }}
    >
      <Interactive.Div
        name="Features heading"
        style={{
          fontFamily: brandFont,
          fontWeight: 700,
          fontSize: 70,
          color: "#ffffff",
          marginBottom: 10,
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Une pharmacie complète, pour vous
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 1"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(frame, [0.6 * fps, 1.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [0.6 * fps, 1.3 * fps],
            ["-36px 0px", "0px 0px"],
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
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 1"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 52,
            color: "#ffffff",
          }}
        >
          Médicaments et produits de santé
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 2"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(frame, [1.3 * fps, 2.0 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [1.3 * fps, 2.0 * fps],
            ["-36px 0px", "0px 0px"],
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
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 2"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 52,
            color: "#ffffff",
          }}
        >
          Équipe professionnelle
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 3"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(frame, [2.0 * fps, 2.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [2.0 * fps, 2.7 * fps],
            ["-36px 0px", "0px 0px"],
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
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 3"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 52,
            color: "#ffffff",
          }}
        >
          Conseils pharmaceutiques
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 4"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(frame, [2.7 * fps, 3.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [2.7 * fps, 3.4 * fps],
            ["-36px 0px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        <Interactive.Div
          name="Bullet 4"
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 4"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 52,
            color: "#ffffff",
          }}
        >
          Service de proximité
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Feature row 5"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(frame, [3.4 * fps, 4.1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [3.4 * fps, 4.1 * fps],
            ["-36px 0px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        <Interactive.Div
          name="Bullet 5"
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        />
        <Interactive.Div
          name="Feature text 5"
          style={{
            fontFamily: brandFont,
            fontWeight: 600,
            fontSize: 52,
            color: "#ffffff",
          }}
        >
          Disponibilité 24h/24
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
