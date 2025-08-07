const options = [
  {
    text: "Play",
    action: "1",
  },
  {
    text: "Options",
    action: "options",
  },
];

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
