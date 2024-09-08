window.requestAnimFrame = window.requestAnimationFrame || (callback => setTimeout(callback, 1000 / 60));

// window height is assumed to be constantly 1920px in order to keep gravity the same on window resize
let pixelsPerFeet = 5; // assigned window an arbitrary height of 384ft

const publicMouseParameters = {
   lmbInfluence: 25, // grab
   rmbInfluence: 5, // cut
}

const privateMouseParameters = {
   down: false,
   button: 1,
   px: 0,
   py: 0,
   x: 0,
   y: 0,
}

const publicPhysicsParameters = {
   gravity: 32 * pixelsPerFeet, // acceleration due to gravity is 32ft/s
   rebound: .5,
}

const privatePhysicsParameters = {
   accuracy: 5, // default 5
   strength: 20, // default 60
   friction: .99, // default .99
}

let partitions = 10;
let clothX = Math.floor(window.innerWidth / partitions);
// divide by aspect ratio (default: 5)
let clothY = clothX / 5;

let backgroundColor = '#000';
let clothColor = '#fff';
document.body.style.backgroundColor = backgroundColor;

let canvas = document.getElementById('cloth');
let ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gradient = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
gradient.addColorStop(.8, clothColor);
gradient.addColorStop(1, backgroundColor);
ctx.strokeStyle = gradient;

class Constraint {
   constructor(p1, p2) {
      this.p1 = p1; this.p2 = p2;
      this.length = partitions;
   }
   draw() {
      ctx.moveTo(this.p1.x, this.p1.y);
      ctx.lineTo(this.p2.x, this.p2.y);
   }
   resolve() {
      let [dx, dy] = [
         this.p1.x - this.p2.x,
         this.p1.y - this.p2.y,
      ]
      let distance = Math.hypot(dx, dy);
      if (distance >= this.length) {
         let difference = (this.length - distance) / distance;
         if (distance > privatePhysicsParameters.strength) this.p1.detach(this);
         let scale = difference / 2 * (1 - this.length / distance);
         let [px, py] = [
            dx * scale,
            dy * scale,
         ]
         !this.p1.pinx && (this.p1.x += px);
         !this.p1.piny && (this.p1.y += py);
         !this.p2.pinx && (this.p2.x -= px);
         !this.p2.piny && (this.p2.y -= py);
      }
      return this;
   }
}

class Point {
   constructor(x, y) {
      this.x = x; this.y = y;
      this.px = x; this.py = y;
      this.vx = 0; this.vy = 0;
      this.pinx = null; this.piny = null;
      this.constraints = [];
   }
   draw() { this.constraints.forEach(c => c.draw()); }
   resolve() {
      if (this.pinx && this.piny) { this.x = this.pinx; this.y = this.piny; }
      else { this.constraints.forEach(c => c.resolve()); }
   }
   apply(x, y) { this.vx += x; this.vy += y; }
   update(delta) {
      if (this.pinx && this.piny) return this;
      let [dx, dy] = [
         this.x - privateMouseParameters.x,
         this.y - privateMouseParameters.y,
      ]
      let distance = Math.hypot(dx, dy);
      if (privateMouseParameters.down) {
         if (privateMouseParameters.button === 1 && distance < publicMouseParameters.lmbInfluence) {
            this.px = this.x - (privateMouseParameters.x - privateMouseParameters.px);
            this.py = this.y - (privateMouseParameters.y - privateMouseParameters.py);
         } else if (distance < publicMouseParameters.rmbInfluence) {
            this.constraints = [];
         }
      }
      this.apply(0, publicPhysicsParameters.gravity);
      let [nx, ny] = [
         this.x + (this.x - this.px) * privatePhysicsParameters.friction + this.vx * delta,
         this.y + (this.y - this.py) * privatePhysicsParameters.friction + this.vy * delta,
      ]
      this.px = this.x; this.py = this.y;
      this.x = nx; this.y = ny;
      this.vx = this.vy = 0;
      if (this.x >= canvas.width) {
         this.px = canvas.width + (canvas.width - this.px) * publicPhysicsParameters.rebound;
         this.x = canvas.width;
      } else if (this.x <= 0) {
         this.px *= -1 * publicPhysicsParameters.rebound;
         this.x = 0;
      }
      if (this.y >= canvas.height) {
         this.py = canvas.height + (canvas.height - this.py) * publicPhysicsParameters.rebound;
         this.y = canvas.height;
      } else if (this.y <= 0) {
         this.py *= -1 * publicPhysicsParameters.rebound;
         this.y = 0;
      }
      return this;
   }
   attach(point) { this.constraints.push(new Constraint(this, point)); }
   detach(constraint) { this.constraints.splice(this.constraints.indexOf(constraint), 1); }
   pin(pinx, piny) { this.pinx = pinx; this.piny = piny; }
}

class Cloth {
   constructor() {
      this.points = [];
      for (let y = 0; y <= clothY; y++) {
         for (let x = 0; x <= clothX; x++) {
            let point = new Point(-1 + x * partitions, .1 + y * partitions);
            y === 0 && point.pin(point.x, point.y);
            x !== 0 && point.attach(this.points[this.points.length - 1]);
            y !== 0 && point.attach(this.points[x + (y - 1) * (clothX + 1)]);
            this.points.push(point);
         }
      }
   }
   update(delta) {
      for (let i = 0; i < privatePhysicsParameters.accuracy; i++) {
         this.points.forEach(point => point.resolve());
      }
      ctx.beginPath();
      this.points.forEach(point => point.update(delta ** 2).draw());
      ctx.stroke();
   }
}

canvas.oncontextmenu = e => e.preventDefault();
canvas.onmousemove = e => {
   const { left, top } = canvas.getBoundingClientRect();
   privateMouseParameters.px = privateMouseParameters.x; privateMouseParameters.py = privateMouseParameters.y;
   privateMouseParameters.x = e.clientX - left; privateMouseParameters.y = e.clientY - top;
}
canvas.onmousedown = e => {
   privateMouseParameters.button = e.which;
   privateMouseParameters.down = true;
}
canvas.onmouseup = () => privateMouseParameters.down = false;

let cloth = new Cloth();
(function update(time) {
   ctx.clearRect(0, 0, canvas.width, canvas.height);
   cloth.update(.016);
   window.requestAnimFrame(update);
})(0);