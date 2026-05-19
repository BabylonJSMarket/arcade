import colors from "picocolors";

const { blue, green, magenta, yellow } = colors;

type ColorFunc = (str: string | number) => string;

export interface TemplateOption {
  name: string;
  display: string;
  color: ColorFunc;
  customCommand?: string;
}

const SETUP_OPTIONS: TemplateOption[] = [
  {
    name: "empty-3d",
    display: "Empty 3D Scene",
    color: blue,
  },
  {
    name: "ThirdPerson",
    display: "Third Person (capsule + arc camera + lights)",
    color: yellow,
  },
  {
    name: "FirstPerson",
    display: "First Person (camera + keyboard input)",
    color: green,
  },
  {
    name: "json-scene",
    display: "JSON Scene (load level from data file)",
    color: magenta,
  },
];

export default SETUP_OPTIONS;
