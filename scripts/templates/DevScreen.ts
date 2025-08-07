import fs from "fs";
import path from "path";

const options = [];
const p = path.resolve(process.cwd(), "./data");
const files = fs.readdirSync(p, null);
files.forEach((file) => {
  if (file[0] === ".") return;
  const text = file.replace(".json", "");
  options.push({ text, action: file });
});

export const StartScreen = {
  worldEntityName: "GamesMenu",
  entities: {
    GamesMenu: {
      components: {
        FollowCamera: {
          offset: 6,
          detachControl: true,
        },
        Movement: {
          stationary: true,
          position: [-1, 0, -1],
          rotation: [0, 1, 0],
        },
        Background: {
          clearColor: [0.2, 0.2, 0.2],
        },
        GamesMenuGUI: {
          options,
        },
        VideoTexture: {
          src: "/Assets/Videos/Arcade-Infinity.mp4",
          loop: true,
          autoplay: true,
        },
      },
    },
  },
};
