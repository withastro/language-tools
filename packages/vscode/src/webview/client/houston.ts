// @ts-nocheck
const poses = {
  default: "circle half-up circle",
  happy: "half-down half-up half-down",
  disappointed: "half-up bar-bottom half-up",
  shocked: "circle-stroke bar circle-stroke",
  grumpy: "bar-top half-down bar-top",
  sad: "circle half-down-bottom circle",
  cry: "half-down square half-down",
  wink: "circle half-up bar",
};
const eyes = [
  "circle",
  "half-down",
  "circle-small",
  "circle-small",
  "square",
  "circle-stroke",
];
const mouths = [
  "circle-small",
  "square",
  "square-small",
  "bar",
  "circle-small",
  "square-small",
];
const randBetween = (from, to) => from + Math.floor(Math.random() * to);
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

class HeyHouston extends HTMLElement {
  constructor() {
    super();
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onResize();
  }

  connectedCallback() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove);
    // this.addEventListener("click", this.onClick);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    // this.removeEventListener("click", this.onClick);
  }

  // onClick() {
  //   const p = Object.keys(poses);
  //   const pose = this.getAttribute("pose") ?? "default";
  //   let index = p.indexOf(pose);
  //   if (index === p.length - 1) {
  //     index = 0;
  //   } else {
  //     index++;
  //   }
  //   this.setAttribute("pose", p[index]);
  // }

  onPointerMove(event) {
    const x = (event.clientX - this._rect.x) / this._rect.width - 0.5;
    const y = (event.clientY - this._rect.y) / this._rect.height - 0.5;
    const deltaX = 0 - x;
    const deltaY = 0 - y;
    const rad = Math.atan2(deltaY, deltaX);
    let deg = rad * (180 / Math.PI);
    deg = deg < 0 ? Math.abs(deg) : deg;

    this.style.setProperty("--x", `${x.toPrecision(2)}`);
    this.style.setProperty("--y", `${y.toPrecision(2)}`);

    this.style.setProperty("--deg", `${lerp(0, -35, Math.abs(deg / 180))}deg`);
  }

  onResize() {
    this._rect = document.documentElement.getBoundingClientRect();
  }

  static get observedAttributes() {
    return ["shapes", "pose"];
  }

  get eye0() {
    return this.querySelector(".eye:first-child");
  }

  get mouth() {
    return this.querySelector(".mouth");
  }

  get eye1() {
    return this.querySelector(".eye:last-child");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "shapes") {
      this.updateShapes(newValue);
    }
    if (name === "pose") {
      const shapes = poses[newValue] ?? poses.default;
      this.updateShapes(shapes);
    }
  }

  reset() {
    if (this._handle) {
      clearTimeout(this._handle);
    }
    this.updateShapes(poses[this.getAttribute("pose") ?? "default"]);
  }

  updateShapes(value) {
    const [eye0, mouth, eye1] = value.split(" ");
    this.eye0.dataset.shape = eye0;
    this.mouth.dataset.shape = mouth;
    this.eye1.dataset.shape = eye1;
  }

  emote(name) {
    const shapes = poses[name] ?? poses.default;
    this.updateShapes(shapes);
    this._handle = setTimeout(() => {
      this.reset();
    }, randBetween(1000, 1750));
  }

  talk() {
    const shapes = poses.default;
    this.updateShapes(shapes);

    let i = 0;
    let pace = randBetween(3, 5);
    const loop = () => {
      i++;
      if (i === pace) {
        const eye = eyes[randBetween(0, eyes.length - 1)];
        this.eye0.dataset.shape = eye;
        this.eye1.dataset.shape = eye;
        pace = randBetween(3, 5);
        i = 0;
      }
      this.mouth.dataset.shape = mouths[randBetween(0, mouths.length - 1)];
      this._handle = setTimeout(() => loop(), randBetween(100, 300));
    };

    loop();

    return {
      stop: () => this.reset(),
    };
  }

  think() {
    this.classList.add("loading");
    return {
      stop: () => {
        this.classList.remove("loading");
      },
    };
  }
}

customElements.define("hey-houston", HeyHouston);
