import type { Avatar } from "../types";
import {
  HEAD_IMGS,
  HEAD_COORDS,
  BODY_IMGS,
  BODY_HEIGHTS,
  BODY_ASPECTS,
  EYE_IMGS,
  NOSE_IMGS,
} from "./assets.generated";

// Typed views over the generated (loosely-typed) asset tables.
interface HeadCoords {
  W: number;
  H: number;
  eyeXL: number;
  eyeXR: number;
  eyeY: number;
  noseX: number;
  noseY: number;
}
interface EyeAsset {
  uri: string;
  aspect: number;
  spanRatio: number;
  hRatio: number;
}
interface NoseAsset {
  uri: string;
  aspect: number;
}

const headImgs = HEAD_IMGS as Record<string, Record<string, string>>;
const headCoords = HEAD_COORDS as Record<string, HeadCoords>;
const bodyImgs = BODY_IMGS as Record<string, Record<string, string>>;
const bodyHeights = BODY_HEIGHTS as Record<string, number>;
const bodyAspects = BODY_ASPECTS as Record<string, number>;
const eyeImgs = EYE_IMGS as Record<string, EyeAsset>;
const noseImgs = NOSE_IMGS as Record<string, NoseAsset>;

const FALLBACK_PALETTE = "lightbrown2";

function headData(type: string, colour: string): { uri: string; coords: HeadCoords } {
  const imgs = headImgs[colour] || headImgs[FALLBACK_PALETTE];
  const coords = headCoords[type] || headCoords.Normal;
  return { uri: imgs[type] || imgs.Normal, coords };
}

function eyeData(type: string): EyeAsset {
  return eyeImgs[type] || eyeImgs.Normal;
}

function noseData(type: string): NoseAsset {
  return noseImgs[type] || noseImgs.Normal;
}

function bodyData(type: string, colour: string): {
  uri: string;
  h: number;
  aspect: number;
} {
  const imgs = bodyImgs[colour] || bodyImgs[FALLBACK_PALETTE];
  return {
    uri: imgs[type] || imgs.Normal,
    h: bodyHeights[type] || 240,
    aspect: bodyAspects[type] || 0.58,
  };
}

// Builds the full standing dog (head + body + eyes + nose) as positioned <img>
// tags. Returns an HTML string, injected via dangerouslySetInnerHTML.
export function buildDogSVG(av: Avatar, size: number): string {
  const body = bodyData(av.body, av.colour);
  const head = headData(av.head, av.colour);
  const eye = eyeData(av.eyes);
  const nose = noseData(av.nose);
  const c = head.coords;

  const HEAD_NATIVE = 120;
  const BODY_TOP_NATIVE = 50;
  const NORMAL_TOTAL = BODY_TOP_NATIVE + 240;
  const scale = size / NORMAL_TOTAL;

  const scaledHeadH = Math.round(HEAD_NATIVE * scale);
  const scaledHeadW = Math.round(scaledHeadH * (c.W / c.H));
  const bodyTopPx = Math.round(BODY_TOP_NATIVE * scale);
  const scaledBodyH = Math.round(body.h * scale);
  const scaledBodyW = Math.round(scaledBodyH * body.aspect);
  const totalH = bodyTopPx + scaledBodyH;
  const containerW = Math.max(scaledHeadW, scaledBodyW) + 4;

  const headLeftPx = Math.round(containerW / 2 - scaledHeadW / 2);
  const hScaleX = scaledHeadW / c.W;
  const hScaleY = scaledHeadH / c.H;

  const eyeLx = headLeftPx + Math.round(c.eyeXL * c.W * hScaleX);
  const eyeRx = headLeftPx + Math.round(c.eyeXR * c.W * hScaleX);
  const eyeSpan = eyeRx - eyeLx;
  const eyeCx = Math.round((eyeLx + eyeRx) / 2);
  const eyeCy = Math.round(c.eyeY * c.H * hScaleY);
  const eyeW = Math.round(eyeSpan * eye.spanRatio * 1.2);
  const eyeH = Math.round(eyeW * eye.hRatio);
  const eyeTop = eyeCy - Math.round(eyeH / 2);

  const noseCx = headLeftPx + Math.round(c.noseX * c.W * hScaleX);
  const noseCy = Math.round(c.noseY * c.H * hScaleY);
  const noseW = Math.round(eyeSpan * 0.9);
  const noseH = Math.round(noseW / nose.aspect);
  const noseTop = noseCy - Math.round(noseH / 2);

  return `<div style="position:relative;width:${containerW}px;height:${totalH}px;margin:0 auto;">
    <img src="${body.uri}" style="position:absolute;top:${bodyTopPx}px;left:50%;transform:translateX(-50%);width:${scaledBodyW}px;height:${scaledBodyH}px;">
    <img src="${head.uri}" style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:${scaledHeadW}px;height:${scaledHeadH}px;">
    <img src="${eye.uri}" style="position:absolute;top:${eyeTop}px;left:${eyeCx}px;transform:translateX(-50%);width:${eyeW}px;height:${eyeH}px;">
    <img src="${nose.uri}" style="position:absolute;top:${noseTop}px;left:${noseCx}px;transform:translateX(-50%);width:${noseW}px;height:${noseH}px;">
  </div>`;
}

// Builds a circular head-only avatar (used for the small home-header face).
export function buildDogFace(av: Avatar | undefined, size: number): string {
  if (!av) {
    return `<i class="ph ph-paw-print" style="font-size:${Math.round(size * 0.5)}px;"></i>`;
  }
  const head = headData(av.head, av.colour);
  const eye = eyeData(av.eyes);
  const nose = noseData(av.nose);
  const c = head.coords;

  // Fit the whole head inside the circular frame (with a little padding),
  // centred both horizontally and vertically, so ears aren't clipped and the
  // eyes/nose sit naturally instead of being pushed up by an over-zoomed crop.
  const pad = size * 0.06;
  const avail = size - pad * 2;
  let scaledHeadH = avail;
  let scaledHeadW = scaledHeadH * (c.W / c.H);
  if (scaledHeadW > avail) {
    scaledHeadW = avail;
    scaledHeadH = scaledHeadW * (c.H / c.W);
  }
  scaledHeadW = Math.round(scaledHeadW);
  scaledHeadH = Math.round(scaledHeadH);
  const headLeft = Math.round((size - scaledHeadW) / 2);
  const headTop = Math.round((size - scaledHeadH) / 2);

  const eyeLx = headLeft + c.eyeXL * scaledHeadW;
  const eyeRx = headLeft + c.eyeXR * scaledHeadW;
  const eyeSpan = eyeRx - eyeLx;
  const eyeCx = (eyeLx + eyeRx) / 2;
  const eyeCy = headTop + c.eyeY * scaledHeadH;
  const eyeW = Math.round(eyeSpan * eye.spanRatio * 1.2);
  const eyeH = Math.round(eyeW * eye.hRatio);

  const noseCx = headLeft + c.noseX * scaledHeadW;
  const noseCy = headTop + c.noseY * scaledHeadH;
  const noseW = Math.round(eyeSpan * 0.9);
  const noseH = Math.round(noseW / nose.aspect);

  return `<div style="width:${size}px;height:${size}px;overflow:hidden;position:relative;border-radius:50%;">
    <img src="${head.uri}" style="position:absolute;top:${headTop}px;left:${headLeft}px;width:${scaledHeadW}px;height:${scaledHeadH}px;">
    <img src="${eye.uri}" style="position:absolute;top:${Math.round(eyeCy - eyeH / 2)}px;left:${Math.round(eyeCx - eyeW / 2)}px;width:${eyeW}px;height:${eyeH}px;">
    <img src="${nose.uri}" style="position:absolute;top:${Math.round(noseCy - noseH / 2)}px;left:${Math.round(noseCx - noseW / 2)}px;width:${noseW}px;height:${noseH}px;">
  </div>`;
}

// Small thumbnail image (single part) used in the avatar-editor grids.
export function headThumb(name: string, colour: string): string {
  const imgs = headImgs[colour] || headImgs[FALLBACK_PALETTE];
  return imgs[name] || imgs.Normal;
}
export function bodyThumb(name: string, colour: string): string {
  const imgs = bodyImgs[colour] || bodyImgs[FALLBACK_PALETTE];
  return imgs[name] || imgs.Normal;
}
export function eyeThumb(name: string): string {
  return (eyeImgs[name] || eyeImgs.Normal).uri;
}
export function noseThumb(name: string): string {
  return (noseImgs[name] || noseImgs.Normal).uri;
}
