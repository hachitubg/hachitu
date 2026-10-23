<template>
  <svg class="board-garden" viewBox="0 0 600 600" aria-hidden="true">
    <defs>
      <pattern id="capital-lawn" width="40" height="40" patternUnits="userSpaceOnUse">
        <path fill="#dbe3bd" d="M0 0h40v40H0z" />
        <path fill="#d4ddb2" d="M0 0h20v20H0zm20 20h20v20H20z" />
      </pattern>
    </defs>
    <path fill="url(#capital-lawn)" d="M0 0h600v600H0z" />
    <path stroke="#f2e5cf" stroke-width="42" d="M0 300h600M300 0v600" />
    <path stroke="#d4c5aa" stroke-width="2" d="M0 278h600M0 322h600M278 0v600M322 0v600" />
    <rect
      x="92"
      y="92"
      width="416"
      height="416"
      rx="88"
      fill="none"
      stroke="#f2e5cf"
      stroke-width="22"
    />
    <g
      v-for="(point, i) in [
        [100, 100],
        [190, 82],
        [410, 82],
        [500, 100],
        [85, 200],
        [515, 200],
        [85, 410],
        [515, 410],
        [100, 500],
        [195, 520],
        [405, 520],
        [500, 500],
      ]"
      :key="i"
      :transform="`translate(${point[0]} ${point[1]})`"
    >
      <ellipse cy="15" rx="28" ry="12" fill="#64734d" opacity=".16" />
      <path d="M-5 0h10v18H-5z" fill="#9b7851" />
      <circle cy="-14" r="25" fill="#879d62" />
      <circle cx="-7" cy="-22" r="18" fill="#a7b97c" />
      <circle cx="9" cy="-12" r="12" fill="#95ab6c" />
    </g>
    <g fill="#ba8860" stroke="#f4d9b3" stroke-width="3">
      <path d="M153 214h64v14h-64zm230 158h64v14h-64zM153 372h64v14h-64zm230-158h64v14h-64z" />
    </g>
    <circle cx="300" cy="300" r="95" fill="#c5b89d" />
    <circle cx="300" cy="297" r="87" fill="#f9edd8" />
    <circle cx="300" cy="297" r="73" fill="#b1cfd1" />
    <circle cx="300" cy="297" r="57" fill="none" stroke="#d1e4df" stroke-width="3" />
    <path d="M280 300q20-36 40 0l-7 17h-26z" fill="#f6ead1" />
    <ellipse cx="300" cy="295" rx="26" ry="10" fill="#fffbec" />
    <path d="M296 267h8v27h-8z" fill="#dcc7a2" />
    <ellipse cx="300" cy="266" rx="17" ry="6" fill="#fffbec" />
    <g fill="#df9274">
      <circle cx="138" cy="140" r="5" />
      <circle cx="462" cy="140" r="5" />
      <circle cx="138" cy="460" r="5" />
      <circle cx="462" cy="460" r="5" />
    </g>
  </svg>
</template>
