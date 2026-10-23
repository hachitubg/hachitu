<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ level: number; name?: string }>(), { name: '' })
const houses = computed(() =>
  props.level === 1
    ? [[72, 65]]
    : props.level === 2
      ? [
          [45, 68],
          [106, 68],
        ]
      : props.level === 3
        ? [
            [20, 70],
            [75, 70],
            [130, 70],
          ]
        : [
            [42, 49],
            [99, 49],
            [17, 80],
            [74, 80],
          ],
)
</script>
<template>
  <svg
    class="property-buildings"
    viewBox="0 0 180 114"
    role="img"
    :aria-label="`${name ? `${name}: ` : ''}${level === 5 ? 'Khách sạn' : `${level} nhà`}`"
  >
    <ellipse cx="90" cy="96" rx="73" ry="12" class="plot-shadow" />
    <path d="m9 89 72-35 90 37-74 22Z" class="plot-base" />
    <template v-if="level < 5">
      <g
        v-for="(p, i) in houses"
        :key="i"
        :transform="`translate(${p[0]} ${p[1]})`"
        class="house-model"
      >
        <path d="m0 0 26 12 19-10-26-12Z" class="house-roof" />
        <path d="m0 0v25l26 13V12Z" class="house-front" />
        <path d="m26 12 19-10v25L26 38Z" class="house-side" />
        <path d="m-3-1 21-14 31 16-22 15Z" class="roof-top" />
        <path d="m4 9 6 3v7l-6-3Zm11 5 6 3v7l-6-3Z" class="house-window" />
        <path d="m10 29 7 3v-9l-7-3Z" class="house-door" />
        <path d="m32 14 6-3v7l-6 3Z" class="house-window" />
      </g>
    </template>
    <g v-else class="hotel-model">
      <path d="m45 37 45 20 44-21V93L89 113 45 92Z" class="hotel-front" />
      <path d="m90 57 44-21V93L90 113Z" class="hotel-side" />
      <path d="m39 33 45-23 57 25-49 26Z" class="hotel-roof" />
      <path d="m51 22 34-16 42 19-36 18Z" class="roof-top" />
      <path
        v-for="n in 3"
        :key="n"
        :d="`m53 ${39 + n * 14} 7 3v7l-7-3Zm14 6 7 3v7l-7-3Zm15 7 5 2v7l-5-2Zm18-3 8-4v7l-8 4Zm16-8 8-4v7l-8 4Z`"
        class="house-window"
      />
      <path d="m69 103 14 7V94l-14-7Z" class="house-door" />
      <path d="M87 7V0m0 0 24 6-24 6" class="hotel-flag" />
    </g>
  </svg>
</template>
<style scoped>
.property-buildings {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  --roof: var(--group, var(--color-accent-coral));
}
.plot-shadow {
  fill: var(--color-text-primary);
  opacity: 0.14;
}
.plot-base {
  fill: #adc18e;
  stroke: #879d6e;
  stroke-width: 1;
}
.house-front {
  fill: #fff0d2;
  stroke: #bda988;
  stroke-width: 1;
}
.house-side {
  fill: #d4be98;
  stroke: #bda988;
  stroke-width: 1;
}
.roof-top {
  fill: var(--roof);
  stroke: var(--color-text-secondary);
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.house-roof {
  fill: #6d5a4c;
}
.house-window {
  fill: #6c9ea4;
  stroke: #fffaf4;
  stroke-width: 1;
}
.house-door {
  fill: #6d5a4c;
}
.hotel-front {
  fill: #fff0d2;
  stroke: #bda988;
  stroke-width: 1;
}
.hotel-side {
  fill: #d9bea2;
  stroke: #bda988;
  stroke-width: 1;
}
.hotel-roof {
  fill: #8e674d;
}
.hotel-flag {
  fill: var(--roof);
  stroke: var(--roof);
  stroke-width: 2;
  stroke-linejoin: round;
}
</style>
