var buildCommands = [
  { compile: "{html,tools}/**" },
  // {
  //   copyDir: "node_modules/@shoelace-style/shoelace/dist/assets",
  //   to: "dist/html/assets",
  // },
  {
    copy: "node_modules/@shoelace-style/shoelace/dist/assets/icons/{chevron-{double-,}{left,right},{play,stop}-fill}.svg",
    base: "node_modules/@shoelace-style/shoelace/dist/assets/",
    to: "dist/html/assets",
  },
];

export default buildCommands;
