import "./index.css";
import { Composition, Folder } from "remotion";
import { MyComposition } from "./Composition";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneVinyl } from "./scenes/SceneVinyl";
import { SceneOffer } from "./scenes/SceneOffer";
import { SceneCTA } from "./scenes/SceneCTA";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="DisquairePromo-Scenes">
        <Composition
          id="Intro"
          component={SceneIntro}
          durationInFrames={110}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Vinyl"
          component={SceneVinyl}
          durationInFrames={190}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Offer"
          component={SceneOffer}
          durationInFrames={190}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="CTA"
          component={SceneCTA}
          durationInFrames={190}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
      <MyComposition />
    </>
  );
};
