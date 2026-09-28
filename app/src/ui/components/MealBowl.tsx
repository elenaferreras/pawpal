import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

interface MealBowlProps {
  /** Number of meals fed today. */
  fed: number;
  /** Total meals per day. */
  total: number;
  /** Rendered width in px (height keeps the 157×115 aspect ratio). */
  width?: number;
}

// Each kibble nugget; `y` is its approximate centre used to empty the bowl
// top-first, `f` are the two gradient fills that stack into one nugget.
const KIBBLES: { d: string; y: number; f: [string, string] }[] = [
  {
    d: "M38.2492 59.2842C45.25 59.2842 48.7483 55.9821 48.7483 51.9087C48.7483 47.8353 45.25 44.5332 38.2492 44.5332C31.2483 44.5332 27.75 47.8353 27.75 51.9087C27.75 55.9821 31.2483 59.2842 38.2492 59.2842Z",
    y: 51.9,
    f: ["url(#paint30_radial_14318_3363)", "url(#paint31_radial_14318_3363)"],
  },
  {
    d: "M58.2348 57.5785C63.2086 53.6159 62.4542 49.569 58.4577 47.0196C54.4611 44.4702 48.7358 44.3837 43.762 48.3463C38.7882 52.3089 39.5426 56.3558 43.5391 58.9051C47.5357 61.4545 53.261 61.5411 58.2348 57.5785Z",
    y: 53,
    f: ["url(#paint32_radial_14318_3363)", "url(#paint33_radial_14318_3363)"],
  },
  {
    d: "M64.8236 60.0953C71.5935 61.3481 76.1738 58.7808 77.6508 54.8418C79.1278 50.9028 76.9423 47.0836 70.1724 45.8309C63.4025 44.5781 58.8222 47.1454 57.3451 51.0844C55.8681 55.0234 58.0537 58.8426 64.8236 60.0953Z",
    y: 53,
    f: ["url(#paint34_radial_14318_3363)", "url(#paint35_radial_14318_3363)"],
  },
  {
    d: "M92.6832 56.1908C96.4939 51.661 94.5105 47.9522 89.7148 46.1695C84.9192 44.3867 79.1273 45.2051 75.3165 49.7349C71.5058 54.2648 73.4892 57.9735 78.2849 59.7563C83.0805 61.539 88.8724 60.7207 92.6832 56.1908Z",
    y: 53,
    f: ["url(#paint36_radial_14318_3363)", "url(#paint37_radial_14318_3363)"],
  },
  {
    d: "M99.2776 60.2368C106.182 61.3957 110.179 58.7183 110.853 54.7011C111.527 50.6839 108.624 46.8482 101.72 45.6892C94.8153 44.5303 90.8186 47.2077 90.1443 51.2249C89.4699 55.2421 92.3733 59.0778 99.2776 60.2368Z",
    y: 53,
    f: ["url(#paint38_radial_14318_3363)", "url(#paint39_radial_14318_3363)"],
  },
  {
    d: "M116.999 59.2842C124 59.2842 127.498 55.9821 127.498 51.9087C127.498 47.8353 124 44.5332 116.999 44.5332C109.998 44.5332 106.5 47.8353 106.5 51.9087C106.5 55.9821 109.998 59.2842 116.999 59.2842Z",
    y: 51.9,
    f: ["url(#paint40_radial_14318_3363)", "url(#paint41_radial_14318_3363)"],
  },
  {
    d: "M45.4288 49.8895C51.7637 49.1518 54.654 46.4201 54.3146 43.505C53.9752 40.59 50.5344 38.5955 44.1996 39.3332C37.8647 40.0708 34.9744 42.8026 35.3138 45.7176C35.6533 48.6327 39.094 50.6271 45.4288 49.8895Z",
    y: 45,
    f: ["url(#paint42_radial_14318_3363)", "url(#paint43_radial_14318_3363)"],
  },
  {
    d: "M62.0493 49.6708C67.21 47.589 67.2727 44.6235 64.169 42.2488C61.0653 39.8741 55.9704 38.9893 50.8098 41.0712C45.6491 43.153 45.5864 46.1185 48.6901 48.4932C51.7938 50.8679 56.8887 51.7527 62.0493 49.6708Z",
    y: 45.4,
    f: ["url(#paint44_radial_14318_3363)", "url(#paint45_radial_14318_3363)"],
  },
  {
    d: "M69.8505 50.8255C76.0831 50.7603 79.9182 48.2858 80.8072 45.2735C81.6962 42.2612 79.3024 39.8518 73.0697 39.9169C66.8371 39.9821 63.002 42.4566 62.113 45.4689C61.224 48.4813 63.6178 50.8907 69.8505 50.8255Z",
    y: 45.4,
    f: ["url(#paint46_radial_14318_3363)", "url(#paint47_radial_14318_3363)"],
  },
  {
    d: "M95.1471 47.5952C98.9307 44.3495 97.4136 41.6408 93.2099 40.3C89.0062 38.9592 83.7077 39.4942 79.9242 42.7399C76.1406 45.9856 77.6578 48.6943 81.8615 50.0351C86.0652 51.3759 91.3636 50.8409 95.1471 47.5952Z",
    y: 45.4,
    f: ["url(#paint48_radial_14318_3363)", "url(#paint49_radial_14318_3363)"],
  },
  {
    d: "M102.264 50.544C108.442 52.1297 112.12 50.6177 112.85 47.7751C113.58 44.9325 111.084 41.8358 104.907 40.2501C98.7294 38.6644 95.0511 40.1764 94.3214 43.019C93.5917 45.8616 96.0871 48.9583 102.264 50.544Z",
    y: 46,
    f: ["url(#paint50_radial_14318_3363)", "url(#paint51_radial_14318_3363)"],
  },
  {
    d: "M60.9796 45.036C67.3145 44.2983 70.2048 41.5666 69.8654 38.6515C69.5259 35.7365 66.0852 33.742 59.7504 34.4797C53.4155 35.2173 50.5252 37.949 50.8646 40.8641C51.2041 43.7791 54.6448 45.7736 60.9796 45.036Z",
    y: 40,
    f: ["url(#paint52_radial_14318_3363)", "url(#paint53_radial_14318_3363)"],
  },
  {
    d: "M62.7296 38.6629C69.0645 37.9252 71.9548 35.1935 71.6154 32.2785C71.2759 29.3634 67.8352 27.3689 61.5004 28.1066C55.1655 28.8443 52.2752 31.576 52.6146 34.491C52.9541 37.4061 56.3948 39.4006 62.7296 38.6629Z",
    y: 33.7,
    f: ["url(#paint54_radial_14318_3363)", "url(#paint55_radial_14318_3363)"],
  },
  {
    d: "M81.979 42.8456C87.1397 40.7638 87.2024 37.7983 84.0987 35.4236C80.995 33.0489 75.9001 32.1641 70.7395 34.246C65.5788 36.3278 65.5161 39.2933 68.6198 41.668C71.7235 44.0427 76.8183 44.9275 81.979 42.8456Z",
    y: 38.5,
    f: ["url(#paint56_radial_14318_3363)", "url(#paint57_radial_14318_3363)"],
  },
  {
    d: "M78.979 34.7216C84.1397 32.6397 84.2024 29.6743 81.0987 27.2996C77.995 24.9249 72.9001 24.0401 67.7395 26.1219C62.5788 28.2038 62.5161 31.1692 65.6198 33.544C68.7235 35.9187 73.8183 36.8035 78.979 34.7216Z",
    y: 30.4,
    f: ["url(#paint58_radial_14318_3363)", "url(#paint59_radial_14318_3363)"],
  },
  {
    d: "M87.5993 43.3541C93.5011 45.3589 97.9397 44.2959 99.7771 41.7486C101.614 39.2014 100.155 36.1346 94.2532 34.1298C88.3514 32.1249 83.9128 33.188 82.0754 35.7352C80.238 38.2824 81.6976 41.3492 87.5993 43.3541Z",
    y: 38.7,
    f: ["url(#paint60_radial_14318_3363)", "url(#paint61_radial_14318_3363)"],
  },
  {
    d: "M87.15 36.8732C93.2517 38.1458 97.5282 36.551 99.0423 33.7993C100.556 31.0476 98.7348 28.181 92.6331 26.9084C86.5314 25.6359 82.255 27.2307 80.7409 29.9824C79.2268 32.7341 81.0483 35.6007 87.15 36.8732Z",
    y: 31.9,
    f: ["url(#paint62_radial_14318_3363)", "url(#paint63_radial_14318_3363)"],
  },
  {
    d: "M119.3 48.5419C124.122 47.2767 123.941 44.1773 120.747 41.1338C117.552 38.0903 112.553 36.2553 107.731 37.5205C102.909 38.7857 103.09 41.8852 106.284 44.9287C109.479 47.9722 114.478 49.8072 119.3 48.5419Z",
    y: 43,
    f: ["url(#paint64_radial_14318_3363)", "url(#paint65_radial_14318_3363)"],
  },
  {
    d: "M109.107 42.9606C113.633 40.8708 112.913 37.8508 109.234 35.4136C105.556 32.9763 100.313 32.0448 95.7873 34.1346C91.2615 36.2243 91.9817 39.2443 95.6598 41.6816C99.338 44.1188 104.581 45.0503 109.107 42.9606Z",
    y: 38.5,
    f: ["url(#paint66_radial_14318_3363)", "url(#paint67_radial_14318_3363)"],
  },
];

const BOWL_RIM_D =
  "M78.375 67.252C120.95 67.252 155.596 73.6279 156.722 81.5732H156.75V100.67H156.722C155.599 108.616 120.952 114.992 78.375 114.992C35.7983 114.992 1.15134 108.616 0.0283203 100.67H0V81.5732H0.0283203C1.15378 73.6279 35.7999 67.252 78.375 67.252Z";
const BOWL_BODY_D =
  "M78 38.6221C111.137 38.6221 138 43.9947 138 50.6221L147.145 78.4072C147.543 79.0093 147.75 79.6232 147.75 80.2471C147.75 87.91 116.69 94.1221 78.375 94.1221C40.0602 94.1221 9 87.91 9 80.2471C9 79.6717 9.17552 79.1048 9.51562 78.5479L18 50.6221C18 43.9947 44.8629 38.6221 78 38.6221Z";
const BONE_D =
  "M58.317 78.9668C58.6178 78.636 58.6229 78.1022 58.3282 77.766C57.8646 77.237 57.5061 76.6011 57.2957 75.8817C56.5227 73.2393 58.0381 70.4707 60.6805 69.6978C63.1102 68.9869 65.6003 70.2952 66.6048 72.4256C67.0847 73.4434 67.9654 74.3831 69.0907 74.3831L87.6262 74.3831C88.7277 74.3831 89.5982 73.4836 90.0726 72.4895C90.0838 72.466 90.0953 72.4426 90.1069 72.4192C91.3306 69.9531 94.3218 68.9458 96.788 70.1695C99.2541 71.3931 100.12 74.0029 98.8965 76.4691C98.6743 76.9168 98.3168 77.3785 97.9358 77.7705C97.6242 78.0911 97.6193 78.629 97.9291 78.9512C98.5112 79.5565 99.063 80.3328 99.2805 81.0766C100.054 83.719 98.5381 86.4877 95.8958 87.2606C93.4695 87.9704 90.9818 86.667 89.9749 84.5405C89.4944 83.5257 88.6148 82.5899 87.4919 82.5899L68.9433 82.59C67.8443 82.59 66.975 83.4857 66.5 84.4768C66.4532 84.5745 66.403 84.671 66.3495 84.7661C66.156 85.1109 65.9268 85.4246 65.6687 85.7045C65.4105 85.9846 65.1235 86.2311 64.8147 86.4415C64.2038 86.8595 63.5201 87.1264 62.8168 87.242C62.107 87.3599 61.367 87.3253 60.6479 87.1212C60.1152 86.9712 59.6021 86.7306 59.1337 86.3999C59.113 86.3854 59.0925 86.3707 59.0721 86.3559C59.0419 86.334 59.0121 86.3119 58.9826 86.2895C58.5517 85.962 58.1852 85.5722 57.8896 85.1395C57.4688 84.526 57.2003 83.8388 57.0847 83.1319C56.9722 82.4514 56.9999 81.7434 57.1827 81.0527C57.2265 80.8867 57.2795 80.722 57.3415 80.5586C57.4915 80.1617 57.6934 79.7797 57.9483 79.4239C58.063 79.263 58.1863 79.1105 58.317 78.9668Z";

// Bone is a single silhouette painted with many stacked gradients for 3D shading.
const BONE_FILLS = [
  "#DCD4E1",
  ...Array.from({ length: 19 }, (_, i) => `url(#paint${10 + i}_radial_14318_3363)`),
];

// Static bowl + bone. Authored asset (not user input) — injected verbatim so the
// 68 gradient/mask/filter defs render pixel-perfect without JSX attribute renaming.
const STATIC_SVG = `
<path d="${BOWL_RIM_D}" fill="url(#paint0_linear_14318_3363)"/>
<path d="${BOWL_RIM_D}" fill="url(#paint1_radial_14318_3363)"/>
<path d="${BOWL_RIM_D}" fill="url(#paint2_linear_14318_3363)"/>
<path d="${BOWL_RIM_D}" fill="url(#paint3_radial_14318_3363)"/>
<path d="${BOWL_BODY_D}" fill="url(#paint4_linear_14318_3363)"/>
<path d="${BOWL_BODY_D}" fill="url(#paint5_radial_14318_3363)"/>
<path d="${BOWL_BODY_D}" fill="url(#paint6_linear_14318_3363)"/>
<path d="${BOWL_BODY_D}" fill="url(#paint7_radial_14318_3363)"/>
<ellipse cx="78" cy="50.6221" rx="50.25" ry="6.75" fill="#D9D9D9"/>
<ellipse cx="78" cy="50.6221" rx="50.25" ry="6.75" fill="url(#paint8_linear_14318_3363)"/>
<ellipse cx="78" cy="50.6221" rx="50.25" ry="6.75" fill="url(#paint9_radial_14318_3363)"/>
<g clip-path="url(#clip0_14318_3363)">
${BONE_FILLS.map((f) => `<path d="${BONE_D}" fill="${f}"/>`).join("")}
<g filter="url(#filter0_f_14318_3363)"><path d="M62.1497 74.6338C60.8688 75.9925 58.6844 76.425 58.0859 76.4412L58.923 77.8605C61.5238 77.0454 62.2306 75.297 62.1497 74.6338Z" fill="url(#paint29_linear_14318_3363)"/></g>
</g>`;

// All gradient, mask, filter and clip definitions (authored asset, injected raw).
const DEFS_SVG = `
<mask id="mask0_14318_3363" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="17" y="0" width="140" height="58">
<path d="M78.0003 57.3768C105.753 57.3768 128.25 54.3547 128.25 50.6268C128.25 48.9636 168.825 5.40773 151.875 2.24693C151.875 2.24693 10.1255 -12.3779 17.6252 32.9969C14.9261 35.5684 27.7503 46.8988 27.7503 50.6268C27.7503 54.3547 50.248 57.3768 78.0003 57.3768Z" fill="#D9D9D9"/>
</mask>
<filter id="filter0_f_14318_3363" x="56.7078" y="73.2557" width="6.82655" height="5.9828" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="0.689059" result="effect1_foregroundBlur_14318_3363"/>
</filter>
<linearGradient id="paint0_linear_14318_3363" x1="6.91548e-07" y1="91.1221" x2="156.75" y2="91.1221" gradientUnits="userSpaceOnUse">
<stop stop-color="#C0443D"/>
<stop offset="0.192456" stop-color="#DB4D2A"/>
<stop offset="0.274249" stop-color="#E73A34"/>
<stop offset="0.498853" stop-color="#E85A36"/>
<stop offset="0.771789" stop-color="#EA6E39"/>
<stop offset="0.845183" stop-color="#F45D46"/>
<stop offset="0.952656" stop-color="#FF6153"/>
<stop offset="1" stop-color="#FF6C43"/>
</linearGradient>
<radialGradient id="paint1_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(78.375 71.9899) rotate(90) scale(59.6617 143.128)">
<stop offset="0.695764" stop-color="#CB5C38" stop-opacity="0"/>
<stop offset="0.891642" stop-color="#CB5C38"/>
</radialGradient>
<linearGradient id="paint2_linear_14318_3363" x1="61.6574" y1="66.133" x2="61.6574" y2="83.6627" gradientUnits="userSpaceOnUse">
<stop stop-color="#EF8D6D"/>
<stop offset="1" stop-color="#EF8D6D" stop-opacity="0"/>
</linearGradient>
<radialGradient id="paint3_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(78.375 115.862) rotate(90) scale(13.5513 96.8902)">
<stop stop-color="#E96A41"/>
<stop offset="1" stop-color="#E96A41" stop-opacity="0"/>
</radialGradient>
<linearGradient id="paint4_linear_14318_3363" x1="9" y1="66.3721" x2="147.75" y2="66.3721" gradientUnits="userSpaceOnUse">
<stop stop-color="#C0443D"/>
<stop offset="0.192456" stop-color="#DB4D2A"/>
<stop offset="0.274249" stop-color="#E73A34"/>
<stop offset="0.498853" stop-color="#E85A36"/>
<stop offset="0.771789" stop-color="#EA6E39"/>
<stop offset="0.845183" stop-color="#F45D46"/>
<stop offset="0.952656" stop-color="#FF6153"/>
<stop offset="1" stop-color="#FF6C43"/>
</linearGradient>
<radialGradient id="paint5_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(78.375 44.1301) rotate(90) scale(69.3592 126.693)">
<stop offset="0.695764" stop-color="#CB5C38" stop-opacity="0"/>
<stop offset="0.891642" stop-color="#CB5C38"/>
</radialGradient>
<linearGradient id="paint6_linear_14318_3363" x1="63.5771" y1="37.3213" x2="63.5771" y2="57.7002" gradientUnits="userSpaceOnUse">
<stop stop-color="#EF8D6D"/>
<stop offset="1" stop-color="#EF8D6D" stop-opacity="0"/>
</linearGradient>
<radialGradient id="paint7_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(78.375 95.1338) rotate(90) scale(15.7539 85.764)">
<stop stop-color="#E96A41"/>
<stop offset="1" stop-color="#E96A41" stop-opacity="0"/>
</radialGradient>
<linearGradient id="paint8_linear_14318_3363" x1="26.4171" y1="51.2973" x2="128.642" y2="41.1445" gradientUnits="userSpaceOnUse">
<stop stop-color="#DF2F2F"/>
<stop offset="0.145662" stop-color="#DF5A51"/>
<stop offset="0.272458" stop-color="#CB513C"/>
<stop offset="0.829774" stop-color="#BC432E"/>
<stop offset="1" stop-color="#971B19"/>
</linearGradient>
<radialGradient id="paint9_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(78 60.673) rotate(90) scale(6.7067 79.3788)">
<stop offset="0.173469" stop-color="#90371F"/>
<stop offset="1" stop-color="#90371F" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint10_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(77.3384 73.6713) rotate(0.160489) scale(21.7428 3.61243)">
<stop offset="0.263875" stop-color="#CFC0D9"/>
<stop offset="1" stop-color="#DED1E7" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint11_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(77.3993 82.746) rotate(-0.250201) scale(27.8943 4.2643)">
<stop offset="0.158995" stop-color="#9D9D9E"/>
<stop offset="1" stop-color="#C2BFC5" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint12_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(55.3216 78.9395) rotate(-17.3226) scale(9.92053 2.14757)">
<stop offset="0.542542" stop-color="#FBFAFC"/>
<stop offset="1" stop-color="#E5E5E5" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint13_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(66.6802 72.3923) rotate(-33.7962) scale(3.98962 3.26082)">
<stop stop-color="#BDA5CC"/>
<stop offset="1" stop-color="#BDA5CC" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint14_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(62.1733 65.3274) rotate(38.9458) scale(11.4331 7.2985)">
<stop offset="0.49631" stop-color="#BDA5CC"/>
<stop offset="1" stop-color="#BDA5CC" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint15_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(97.9848 89.2018) rotate(-124.144) scale(6.40217 10.2476)">
<stop stop-color="#9B9A9B"/>
<stop offset="1" stop-color="#9B9A9B" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint16_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(100.191 79.7122) rotate(144.728) scale(6.11714 4.52651)">
<stop offset="0.164461" stop-color="#C6AED5"/>
<stop offset="1" stop-color="#C6AED5" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint17_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(102.048 75.7839) rotate(155.772) scale(8.01438 3.80774)">
<stop stop-color="#A199A7"/>
<stop offset="1" stop-color="#A199A7" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint18_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(97.4976 80.3098) rotate(-95.4403) scale(3.85431 3.08219)">
<stop offset="0.261346" stop-color="#C0B2C9"/>
<stop offset="1" stop-color="#C0B2C9" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint19_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(99.5075 76.5947) rotate(-58.4957) scale(6.64329 4.99327)">
<stop offset="0.290554" stop-color="#A69BAD"/>
<stop offset="1" stop-color="#C7B7D1" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint20_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(91.8944 72.6359) rotate(-53.8068) scale(6.18828 4.54301)">
<stop offset="0.191091" stop-color="#F5EEF9"/>
<stop offset="1" stop-color="#F5EEF9" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint21_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(75.4627 91.2849) rotate(-45) scale(30.7933 30.0423)">
<stop offset="0.897862" stop-color="#D5BBE5" stop-opacity="0"/>
<stop offset="0.99576" stop-color="#D2B6E4"/>
</radialGradient>
<radialGradient id="paint22_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(65.1576 88.5318) rotate(-33.3922) scale(10.8153 7.33197)">
<stop offset="0.304045" stop-color="#969597"/>
<stop offset="1" stop-color="#A199A7" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint23_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(97.0408 89.9631) rotate(-31.8046) scale(15.6587 6.38096)">
<stop offset="0.304045" stop-color="#969597"/>
<stop offset="1" stop-color="#B9ADC1" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint24_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(67.5328 82.6242) rotate(30.3027) scale(5.43174 2.44644)">
<stop stop-color="#B4A8BB"/>
<stop offset="1" stop-color="#B4A8BB" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint25_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(58.3363 82.1978) rotate(-46.2018) scale(6.15974 6.17672)">
<stop offset="0.102785" stop-color="#FBFAFC"/>
<stop offset="1" stop-color="#E5E5E5" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint26_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(97.3454 80.7057) rotate(114.179) scale(3.27129 1.95676)">
<stop offset="0.145451" stop-color="#D9C7E4"/>
<stop offset="1" stop-color="#D9C7E4" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint27_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(92.3817 82.9896) rotate(31.2284) scale(4.52271)">
<stop offset="0.186476" stop-color="#EDE9F0"/>
<stop offset="1" stop-color="#EDE9F0" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint28_radial_14318_3363" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(58.3363 72.6968) rotate(-53.0702) scale(5.82852 5.55573)">
<stop offset="0.136451" stop-color="#FBFAFC"/>
<stop offset="1" stop-color="#E5E5E5" stop-opacity="0"/>
</radialGradient>
<linearGradient id="paint29_linear_14318_3363" x1="58.6318" y1="77.1326" x2="64.1633" y2="73.1781" gradientUnits="userSpaceOnUse">
<stop stop-color="#B6B0BB"/>
<stop offset="1" stop-color="#C6BFCB" stop-opacity="0"/>
</linearGradient>
<radialGradient id="paint30_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-19.125 14.4888 -20.625 -13.435 45.375 48.2213)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint31_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(5.625 5.79551 -5.98002 2.86424 38.625 52.1727)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint32_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(0.627908 19.8932 -27.8349 3.26566 52.4431 46.6212)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint33_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(9.68255 0.443342 -1.43836 5.17745 51.5245 52.9149)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint34_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-23.7478 10.5886 -15.073 -16.6825 75.7258 50.6724)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint35_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(3.33797 6.61088 -6.82134 1.69969 67.7657 53.2857)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint36_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(6.64761 18.7158 -27.044 7.46527 83.5373 46.7383)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint37_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(9.88499 -1.10316 0.117024 5.12287 84.5153 52.8353)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint38_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-21.2597 11.1228 -18.1163 -16.664 108.137 50.5061)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint39_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(4.58797 6.64673 -6.37167 1.83476 100.826 53.2856)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint40_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-19.125 14.4888 -20.625 -13.435 124.125 48.2213)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint41_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(5.625 5.79551 -5.98002 2.86424 117.375 52.1727)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint42_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-16.0983 12.3838 -19.7825 -7.44132 50.9549 41.2216)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint43_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(5.57285 3.55475 -5.17246 2.67984 45.1763 44.7607)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint44_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-3.05827 14.1341 -25.4406 -1.69909 58.8727 41.1022)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint45_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(8.56236 1.70597 -2.22576 3.44812 56.9078 45.4132)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint46_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-20.1884 10.8927 -15.4297 -9.74341 78.6088 42.578)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint47_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(3.74295 4.2335 -5.94892 2.1738 71.7371 45.563)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint48_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(4.61634 13.6357 -25.0115 5.13983 87.5813 40.6502)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint49_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(9.02091 -0.700211 -0.275986 3.71519 88.0113 45.0802)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint50_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-19.4708 5.77914 -15.7924 -14.0471 110.534 44.4378)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint51_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(3.92523 5.31841 -5.78971 0.644332 103.87 45.6664)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint52_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-16.0983 12.3838 -19.7825 -7.44132 66.5057 36.3681)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint53_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(5.57285 3.55475 -5.17246 2.67984 60.7271 39.9071)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint54_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-16.0983 12.3838 -19.7825 -7.44132 68.2557 29.9951)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint55_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(5.57285 3.55475 -5.17246 2.67984 62.4771 33.5341)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint56_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-3.05827 14.1341 -25.4406 -1.69909 78.8024 34.277)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint57_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(8.56236 1.70597 -2.22576 3.44812 76.8375 38.588)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint58_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-3.05827 14.1341 -25.4406 -1.69909 75.8024 26.153)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint59_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(8.56236 1.70597 -2.22576 3.44812 73.8375 30.4639)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint60_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-22.658 3.58333 -11.3267 -14.3079 98.5967 38.4767)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint61_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(2.12768 5.23499 -6.33316 0.078558 91.124 39.0146)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint62_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-22.0543 6.31125 -12.9821 -12.8248 97.4729 30.6951)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint63_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(2.74831 4.9375 -6.27664 0.847889 90.121 32.1375)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint64_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(-1.80875 14.2818 -24.742 -6.31073 115.531 38.9883)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint65_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(8.41945 3.31361 -1.87227 3.22078 113.982 43.1606)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint66_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(0.719282 14.3779 -25.4647 -1.88208 103.724 34.2142)" gradientUnits="userSpaceOnUse">
<stop stop-color="#693036"/>
<stop offset="0.474827" stop-color="#683136"/>
<stop offset="1" stop-color="#2C050A"/>
</radialGradient>
<radialGradient id="paint67_radial_14318_3363" cx="0" cy="0" r="1" gradientTransform="matrix(8.8695 1.78858 -1.27955 3.4988 102.929 38.5934)" gradientUnits="userSpaceOnUse">
<stop stop-color="#6D3538"/>
<stop offset="1" stop-color="#6D3538" stop-opacity="0"/>
</radialGradient>
<clipPath id="clip0_14318_3363">
<rect width="44.0992" height="44.0992" fill="white" transform="translate(78.4336 109.238) rotate(-135)"/>
</clipPath>`;

/**
 * Dog bowl illustration whose kibble empties as meals are marked fed and refills
 * on undo (Figma node 14318:3363). Bowl and bone are static; the ~19 kibble
 * nuggets drain top-first based on `fed / total`.
 */
export function MealBowl({ fed, total, width = 132 }: MealBowlProps): React.ReactElement {
  const reduce = useReducedMotion();
  const height = Math.round((width * 115) / 157);

  const removeCount = useMemo(() => {
    const t = Math.max(1, total);
    const clampedFed = Math.min(Math.max(fed, 0), t);
    const visible = Math.round((KIBBLES.length * (t - clampedFed)) / t);
    return KIBBLES.length - visible;
  }, [fed, total]);

  // Removal rank per kibble: 0 = highest in the pile (emptied first).
  const ranks = useMemo(() => {
    const order = KIBBLES.map((_, i) => i).sort((a, b) => KIBBLES[a].y - KIBBLES[b].y);
    const result: number[] = [];
    order.forEach((idx, rank) => {
      result[idx] = rank;
    });
    return result;
  }, []);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 157 115"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS_SVG }} />
      <g dangerouslySetInnerHTML={{ __html: STATIC_SVG }} />
      <g mask="url(#mask0_14318_3363)">
        {KIBBLES.map((k, i) => {
          const hidden = ranks[i] < removeCount;
          return (
            <motion.g
              key={i}
              initial={false}
              animate={{ opacity: hidden ? 0 : 1, scale: hidden ? 0.2 : 1 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.4, ease: "easeInOut", delay: ranks[i] * 0.02 }
              }
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <path d={k.d} fill={k.f[0]} />
              <path d={k.d} fill={k.f[1]} />
            </motion.g>
          );
        })}
      </g>
    </svg>
  );
}
