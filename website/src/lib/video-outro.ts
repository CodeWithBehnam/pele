const W = 966;
const H = 4096 / 3;
const phoneFadeStart = 2200;
export const phoneShrinkLength = 2560;
export const outroLength = phoneShrinkLength + 1500;
export const endHold = 2700;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function phoneGeometry(elapsed: number) {
  const time = elapsed + 140 * ease((elapsed - phoneFadeStart) / (phoneShrinkLength - phoneFadeStart));
  const phase = clamp(time / 2700);
  const widthProgress = ease(phase ** 2);
  const progress = ease(clamp((time - 2000) / 700) ** 2);
  const width = mix(W, 14, widthProgress);
  const layoutHeight = mix(H, 200.333, progress);
  const height = layoutHeight + 200 * (1 - progress);
  const x = (W - width) / 2;
  const y = mix(H / 2, 906.5, progress) - height / 2;
  const padding = Math.min(mix(30, 40, widthProgress), width / 8, height / 8);
  return { progress, width, height, layoutHeight, x, y, padding };
}

export function createVideoOutro(film: HTMLElement, diagram: HTMLElement, mobile?: { scale: number; height: number }) {
  const svg = film.querySelector<SVGSVGElement>('.outro')!;
  const screen = svg.querySelector<SVGRectElement>('.outro-screen')!;
  const word = svg.querySelector<SVGGElement>('.outro-word')!;
  const letters = [...svg.querySelectorAll<SVGPathElement>('.outro-letter')];
  const icon = svg.querySelector<SVGGElement>('.outro-icon')!;
  const card = film.querySelector<HTMLElement>('.end-card')!;
  const copy = film.querySelector<HTMLElement>('.film-copy')!;
  const source = film.querySelector<HTMLElement>('.source')!;
  let active = false;
  return (elapsed: number) => {
    if (elapsed < 0) {
      if (active) {
        film.style.removeProperty('background');
        svg.style.opacity = '0';
        copy.style.removeProperty('clip-path');
        source.style.removeProperty('opacity');
        diagram.style.removeProperty('opacity');
        delete diagram.dataset.fixedScale;
        diagram.style.left = '30px';
        diagram.style.right = '30px';
        diagram.style.removeProperty('top');
        diagram.style.removeProperty('bottom');
        diagram.style.removeProperty('clip-path');
        card.style.removeProperty('opacity');
      }
      active = false;
      source.style.opacity = String(1 - ease((elapsed + 300) / 800));
      return;
    }
    const time = elapsed;
    active = true;
    film.style.background = '#100f0f';
    svg.style.opacity = '1';
    source.style.opacity = String(1 - ease((time + 300) / 800));
    const { progress, width, height, layoutHeight, x, y, padding } = phoneGeometry(elapsed);
    screen.setAttribute('x', String(x));
    screen.setAttribute('y', String(y));
    screen.setAttribute('width', String(width));
    screen.setAttribute('height', String(height));
    const radius = Math.min(mix(100, 7, progress), width / 2);
    screen.setAttribute('rx', String(radius));
    copy.style.clipPath = `inset(${y}px ${W - x - width}px ${H - y - height}px ${x}px round ${radius}px)`;
    const box = diagram.querySelector('svg')?.viewBox.baseVal;
    const horizontal = box ? box.width > box.height : false;
    const fixedScale = !horizontal && mobile ? mobile.scale * Math.min(1, (layoutHeight - 2 * padding) / mobile.height) : box ? Math.min(906 / box.width, (H - 564) / box.height, 4, (width - 2 * padding) / box.width) : 1;
    diagram.dataset.fixedScale = String(fixedScale);
    const centerY = !horizontal && mobile ? y + height / 2 : (400 + H - 164) / 2;
    const top = !horizontal && mobile ? centerY - H / 2 : 400;
    const bottom = !horizontal && mobile ? H / 2 - centerY : 164;
    diagram.style.left = '30px';
    diagram.style.right = '30px';
    diagram.style.top = `${top}px`;
    diagram.style.bottom = `${bottom}px`;
    diagram.style.opacity = String(1 - ease((time - phoneFadeStart) / 300));
    diagram.style.clipPath = `inset(${y - top}px ${W - 30 - x - width}px ${H - bottom - y - height}px ${x - 30}px round ${radius}px)`;
    const typed = Math.max(0, Math.min(4, Math.floor((time - (phoneShrinkLength + 150)) / 210) + 1));
    const ends = [622, 1092.52, 1568.38, 1773.02, 2276];
    const wordWidth = (ends[typed] - 622) / 3;
    const offset = (W - wordWidth) / 2 - 622 / 3;
    word.setAttribute('transform', `translate(${offset} 0)`);
    letters.forEach((letter, index) => { letter.style.opacity = index < typed ? '1' : '0'; });
    if (time >= phoneShrinkLength) {
      screen.setAttribute('x', String(typed ? (W + wordWidth) / 2 + 12 : W / 2 - 7));
      const age = time - (phoneShrinkLength + 1000);
      const cycle = Math.floor(age / 900);
      const phase = age % 900;
      const blink = age < 0 ? 1 : cycle >= 3 ? 0
        : (cycle === 0 ? 1 : ease(phase / 120)) * (1 - ease((phase - 300) / 120));
      screen.style.opacity = String(blink);
    } else screen.style.opacity = '1';
    const muted = ease((time - (phoneShrinkLength - 90)) / 180);
    screen.setAttribute('fill', `rgb(${[255, 252, 240].map((channel, i) => Math.round(mix(channel, [111, 110, 105][i], muted))).join(' ')})`);
    const pop = clamp((time - (phoneShrinkLength + 840)) / 440);
    const spring = 1 + 2.70158 * (pop - 1) ** 3 + 1.70158 * (pop - 1) ** 2;
    const scale = mix(.84, 1, spring);
    icon.setAttribute('transform', `translate(482 511) scale(${scale}) translate(-482 -511)`);
    icon.style.opacity = String(ease((time - (phoneShrinkLength + 840)) / 180));
    card.style.opacity = time >= phoneShrinkLength + 3900 ? '1' : '0';
  };
}
