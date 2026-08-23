import "./index.css";
import { Composition, Folder } from "remotion";
import { MyComposition } from "./Composition";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneLogo } from "./scenes/SceneLogo";
import { SceneFeatures } from "./scenes/SceneFeatures";
import { SceneEngagement } from "./scenes/SceneEngagement";
import { SceneEndCard } from "./scenes/SceneEndCard";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="NovaPresentation-Scenes">
        <Composition
          id="Intro"
          component={SceneIntro}
          durationInFrames={246}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Logo"
          component={SceneLogo}
          durationInFrames={83}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Features"
          component={SceneFeatures}
          durationInFrames={246}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Engagement"
          component={SceneEngagement}
          durationInFrames={245}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="EndCard"
          component={SceneEndCard}
          durationInFrames={117}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
      <MyComposition />
    </>
  );
};
